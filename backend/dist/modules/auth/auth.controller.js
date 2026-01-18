import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
export const authController = {
    async register(req, reply) {
        const { email, password, name, role } = req.body || {};
        if (!email || !password || !name) {
            return reply.status(400).send({ message: "email, password, name sunt obligatorii" });
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(409).send({ message: "Email deja folosit" });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: passwordHash,
                role: role === "PROFESSOR" ? "PROFESSOR" : "STUDENT",
            },
            select: { id: true, email: true, name: true, role: true },
        });
        return reply.status(201).send({ user });
    },
    async login(req, reply) {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return reply.status(400).send({ message: "email si password sunt obligatorii" });
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.status(401).send({ message: "Email sau parola invalide" });
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return reply.status(401).send({ message: "Email sau parola invalide" });
        }
        const token = req.server.jwt.sign({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });
        reply.setCookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
            // secure: true, // enable on HTTPS
        });
        return reply.send({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    },
    async logout(_req, reply) {
        reply.clearCookie("token", { path: "/" });
        return reply.send({ ok: true });
    },
    async me(req, reply) {
        try {
            const token = req.cookies?.token;
            if (!token)
                return reply.status(401).send({ message: "Neautorizat" });
            const payload = req.server.jwt.verify(token);
            const userId = payload?.sub;
            if (!userId)
                return reply.status(401).send({ message: "Neautorizat" });
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true, role: true },
            });
            if (!user)
                return reply.status(401).send({ message: "Neautorizat" });
            return reply.send({ user });
        }
        catch {
            return reply.status(401).send({ message: "Neautorizat" });
        }
    },
};
