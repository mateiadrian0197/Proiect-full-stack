import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

function requireProfessor(request: any, reply: any) {
  if (request.user?.role !== "PROFESSOR") {
    return reply.status(403).send({ message: "Doar profesorii pot crea sau modifica cursuri" });
  }
}

export async function courseRoutes(app: FastifyInstance) {
  // list courses (public)
  app.get("/courses", async (request: any) => {
    const { search, category } = request.query as { search?: string; category?: string };
    const searchValue = search?.trim();
    const categoryValue = category?.trim();

    return prisma.course.findMany({
      where: {
        ...(searchValue
          ? {
              OR: [
                { title: { contains: searchValue, mode: "insensitive" } },
                { description: { contains: searchValue, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(categoryValue ? { category: { equals: categoryValue, mode: "insensitive" } } : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { resources: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // get course details (public)
  app.get("/courses/:id", async (request: any, reply) => {
    const { id } = request.params as { id: string };

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        resources: { orderBy: { createdAt: "desc" } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!course) return reply.status(404).send({ message: "Curs inexistent" });
    return course;
  });

  // create course (professor only)
  app.post(
    "/courses",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const deny = requireProfessor(request, reply);
      if (deny) return deny;

      const body = request.body as { title: string; description: string; category: string };
      const title = (body?.title || "").trim();
      const description = (body?.description || "").trim();
      const category = (body?.category || "").trim();

      if (!title || !description || !category) {
        return reply.status(400).send({ message: "title, description si category sunt obligatorii" });
      }

      const course = await prisma.course.create({
        data: {
          title,
          description,
          category,
          ownerId: request.user.sub,
        },
      });

      return course;
    }
  );

  // update course (owner only)
  app.put(
    "/courses/:id",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { title?: string; description?: string; category?: string };

      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ message: "Curs inexistent" });
      if (course.ownerId !== request.user.sub) {
        return reply.status(403).send({ message: "Nu ai acces la acest curs" });
      }

      const data: { title?: string; description?: string; category?: string } = {};
      if (body?.title !== undefined) {
        const t = body.title.trim();
        if (!t) return reply.status(400).send({ message: "title invalid" });
        data.title = t;
      }
      if (body?.description !== undefined) {
        const d = body.description.trim();
        if (!d) return reply.status(400).send({ message: "description invalid" });
        data.description = d;
      }
      if (body?.category !== undefined) {
        const c = body.category.trim();
        if (!c) return reply.status(400).send({ message: "category invalid" });
        data.category = c;
      }

      return prisma.course.update({ where: { id }, data });
    }
  );

  // delete course (owner only)
  app.delete(
    "/courses/:id",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ message: "Curs inexistent" });
      if (course.ownerId !== request.user.sub) {
        return reply.status(403).send({ message: "Nu ai acces la acest curs" });
      }

      await prisma.course.delete({ where: { id } });
      return { message: "Deleted" };
    }
  );

  // add resource (owner only)
  app.post(
    "/courses/:id/resources",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { title: string; url: string; type: "PDF" | "LINK" | "VIDEO" };

      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ message: "Curs inexistent" });
      if (course.ownerId !== request.user.sub) {
        return reply.status(403).send({ message: "Nu ai acces la acest curs" });
      }

      const title = (body?.title || "").trim();
      const url = (body?.url || "").trim();
      const type = body?.type;

      if (!title || !url || !type) {
        return reply.status(400).send({ message: "title, url si type sunt obligatorii" });
      }

      return prisma.resource.create({
        data: {
          title,
          url,
          type,
          courseId: id,
        },
      });
    }
  );

  // delete resource (owner only)
  app.delete(
    "/resources/:id",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      const resource = await prisma.resource.findUnique({ where: { id } });
      if (!resource) return reply.status(404).send({ message: "Resursa inexistenta" });

      const course = await prisma.course.findUnique({ where: { id: resource.courseId } });
      if (!course || course.ownerId !== request.user.sub) {
        return reply.status(403).send({ message: "Nu ai acces la aceasta resursa" });
      }

      await prisma.resource.delete({ where: { id } });
      return { message: "Deleted" };
    }
  );

  // add comment (auth)
  app.post(
    "/courses/:id/comments",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { content: string };

      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ message: "Curs inexistent" });

      const content = (body?.content || "").trim();
      if (!content) return reply.status(400).send({ message: "content este obligatoriu" });

      return prisma.comment.create({
        data: {
          content,
          courseId: id,
          userId: request.user.sub,
        },
      });
    }
  );

  // delete comment (owner only)
  app.delete(
    "/comments/:id",
    { preHandler: [app.authenticate] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      const comment = await prisma.comment.findUnique({ where: { id } });
      if (!comment) return reply.status(404).send({ message: "Comentariu inexistent" });
      if (comment.userId !== request.user.sub) {
        return reply.status(403).send({ message: "Nu ai acces la acest comentariu" });
      }

      await prisma.comment.delete({ where: { id } });
      return { message: "Deleted" };
    }
  );
}
