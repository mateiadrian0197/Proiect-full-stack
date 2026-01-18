import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "./api/api";

type Role = "STUDENT" | "PROFESSOR";

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  owner: { id: string; name: string };
  _count: { resources: number; comments: number };
};

type Resource = {
  id: string;
  title: string;
  url: string;
  type: "PDF" | "LINK" | "VIDEO";
  createdAt: string;
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
};

type CourseDetail = CourseSummary & {
  resources: Resource[];
  comments: Comment[];
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function getApiMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

export default function App() {
  // Auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<Role>("STUDENT");
  const [user, setUser] = useState<User | null>(null);

  // Data
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);

  // UI inputs
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newCourse, setNewCourse] = useState({ title: "", description: "", category: "" });
  const [newResource, setNewResource] = useState({ title: "", url: "", type: "LINK" as Resource["type"] });
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: "ok" | "bad" } | null>(null);
  const showToast = (text: string, type: "ok" | "bad" = "ok") => {
    setToast({ text, type });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2200);
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get<CourseSummary[]>("/courses", {
        params: { search: search.trim() || undefined, category: categoryFilter.trim() || undefined },
      });
      setCourses(res.data);
      if (selectedId && !res.data.find((c) => c.id === selectedId)) {
        setSelectedId(null);
        setSelectedCourse(null);
      }
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot incarca lista de cursuri"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const loadCourse = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get<CourseDetail>(`/courses/${id}`);
      setSelectedCourse(res.data);
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot incarca cursul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    const e = email.trim();
    if (!e) return showToast("Completeaza email-ul", "bad");
    if (!password) return showToast("Completeaza parola", "bad");

    setLoading(true);
    try {
      await api.post("/auth/login", { email: e, password });
      const me = await api.get("/auth/me");
      setUser(me.data.user);
      showToast("Login reusit", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Login esuat"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      setLoading(false);
      showToast("Logout", "ok");
    }
  };

  const register = async () => {
    const name = registerName.trim();
    const e = registerEmail.trim();
    if (!name) return showToast("Completeaza numele", "bad");
    if (!e) return showToast("Completeaza email-ul", "bad");
    if (!registerPassword) return showToast("Completeaza parola", "bad");

    setLoading(true);
    try {
      await api.post("/auth/register", { name, email: e, password: registerPassword, role: registerRole });
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterRole("STUDENT");
      setEmail(e);
      setPassword("");
      showToast("Cont creat. Te poti loga.", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot crea contul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async () => {
    const title = newCourse.title.trim();
    const description = newCourse.description.trim();
    const category = newCourse.category.trim();
    if (!title || !description || !category) {
      return showToast("Completeaza toate campurile pentru curs", "bad");
    }

    setLoading(true);
    try {
      await api.post("/courses", { title, description, category });
      setNewCourse({ title: "", description: "", category: "" });
      await loadCourses();
      showToast("Curs creat", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot crea cursul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const addResource = async () => {
    if (!selectedCourse) return;
    const title = newResource.title.trim();
    const url = newResource.url.trim();
    if (!title || !url) return showToast("Completeaza titlul si URL-ul", "bad");

    setLoading(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/resources`, {
        title,
        url,
        type: newResource.type,
      });
      setNewResource({ title: "", url: "", type: "LINK" });
      await loadCourse(selectedCourse.id);
      showToast("Resursa adaugata", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot adauga resursa"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const deleteResource = async (resourceId: string) => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      await api.delete(`/resources/${resourceId}`);
      await loadCourse(selectedCourse.id);
      showToast("Resursa stearsa", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot sterge resursa"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!selectedCourse) return;
    const content = newComment.trim();
    if (!content) return showToast("Scrie un comentariu", "bad");

    setLoading(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/comments`, { content });
      setNewComment("");
      await loadCourse(selectedCourse.id);
      showToast("Comentariu trimis", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot trimite comentariul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      await api.delete(`/comments/${commentId}`);
      await loadCourse(selectedCourse.id);
      showToast("Comentariu sters", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot sterge comentariul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async () => {
    if (!selectedCourse) return;
    const ok = window.confirm("Sigur vrei sa stergi acest curs?");
    if (!ok) return;

    setLoading(true);
    try {
      await api.delete(`/courses/${selectedCourse.id}`);
      setSelectedCourse(null);
      setSelectedId(null);
      await loadCourses();
      showToast("Curs sters", "ok");
    } catch (err) {
      console.error(err);
      showToast(getApiMessage(err, "Nu pot sterge cursul"), "bad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadCourse(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [courses]);

  const isOwner = user && selectedCourse && selectedCourse.owner.id === user.id;
  const isProfessor = user?.role === "PROFESSOR";

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-28 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(12,120,110,0.18),transparent_60%)] blur-3xl opacity-70 float-slow" />
        <div className="absolute -bottom-24 -right-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(194,65,12,0.2),transparent_60%)] blur-3xl opacity-70 float-slower" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(255,246,230,0.8),transparent)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="sticker inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold">
              Biblioteca digitala - demo full-stack
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl">
              Biblioteca de cursuri, <span className="text-[var(--brand)]">resurse si discutii</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
              Descopera cursuri, adauga resurse si participa la conversatii.{" "}
              {user ? (
                <>
                  Esti logat ca <span className="font-semibold">{user.name}</span> ({user.email}).
                </>
              ) : (
                <>Autentifica-te pentru a comenta sau crea cursuri.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadCourses}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm hover:bg-[#fff4e7] disabled:opacity-60"
            >
              Reincarca lista
            </button>
            {user ? (
              <button
                onClick={logout}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Iesire
              </button>
            ) : null}
          </div>
        </header>

        {!user ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_360px] fade-up">
            <div className="panel p-6">
              <div className="label text-[var(--accent)]">Acces</div>
              <h2 className="mt-2 text-2xl">Autentificare</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Intra cu un cont existent.</p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs text-[var(--muted)]">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: nume@exemplu.com"
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Parola</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="parola ta"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") login();
                    }}
                  />
                </div>

                <button
                  onClick={login}
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Intra in cont
                </button>
              </div>
            </div>

            <div className="panel p-6">
              <div className="label text-[var(--brand)]">Cont nou</div>
              <h2 className="mt-2 text-2xl">Creeaza cont</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Alege rolul si completeaza datele.</p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs text-[var(--muted)]">Nume</label>
                  <input
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="ex: Popescu Ion"
                    autoComplete="name"
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Email</label>
                  <input
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="ex: nume@exemplu.com"
                    autoComplete="email"
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Parola</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="minim 4 caractere"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") register();
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Rol</label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="PROFESSOR">Profesor</option>
                  </select>
                </div>

                <button
                  onClick={register}
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Creeaza cont
                </button>
              </div>
            </div>

            <div className="panel p-6">
              <div className="label text-[var(--accent)]">Ghid rapid</div>
              <h2 className="mt-2 text-2xl">Cum functioneaza</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                <div className="panel-soft p-3">
                  <div className="font-semibold text-[var(--ink)]">Student</div>
                  <p>Explori cursuri si resurse. Poti comenta si salva idei.</p>
                </div>
                <div className="panel-soft p-3">
                  <div className="font-semibold text-[var(--ink)]">Profesor</div>
                  <p>Creezi cursuri, adaugi resurse si gestionezi feedback.</p>
                </div>
                <div className="panel-soft p-3">
                  <div className="font-semibold text-[var(--ink)]">Public</div>
                  <p>Lista de cursuri este publica, cu detalii si descrieri.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr_360px] fade-up">
            <aside className="panel p-5">
              <div className="label text-[var(--accent)]">Profil</div>
              <div className="mt-3">
                <div className="text-lg font-semibold">{user.name}</div>
                <div className="text-sm text-[var(--muted)]">{user.email}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Rol: {user.role}</div>
              </div>

              <div className="mt-5 panel-soft p-3">
                <div className="text-xs text-[var(--muted)]">API activ</div>
                <div className="text-sm font-semibold text-[var(--ink)]">localhost:3000</div>
              </div>

              <div className="mt-6">
                <div className="label text-[var(--brand)]">Filtre</div>
                <div className="mt-2 space-y-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cauta dupa titlu"
                    className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  >
                    <option value="">Toate categoriile</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadCourses}
                    disabled={loading}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#fff4e7] disabled:opacity-60"
                  >
                    Aplica filtre
                  </button>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("");
                    }}
                    disabled={loading}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#fff4e7] disabled:opacity-60"
                  >
                    Reseteaza
                  </button>
                </div>
              </div>

              {isProfessor && (
                <div className="mt-6">
                  <div className="label text-[var(--brand)]">Curs nou</div>
                  <div className="mt-2 space-y-2">
                    <input
                      value={newCourse.title}
                      onChange={(e) => setNewCourse((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Titlu curs"
                      className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                    />
                    <input
                      value={newCourse.category}
                      onChange={(e) => setNewCourse((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="Categorie (ex: Web, Design)"
                      className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                    />
                    <textarea
                      value={newCourse.description}
                      onChange={(e) => setNewCourse((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Descriere curs"
                      className="min-h-[96px] w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                    />
                    <button
                      onClick={createCourse}
                      disabled={loading}
                      className="w-full rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      Creeaza curs
                    </button>
                  </div>
                </div>
              )}
            </aside>

            <section className="panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="label text-[var(--accent)]">Catalog</div>
                  <h2 className="mt-2 text-2xl">Cursuri disponibile</h2>
                </div>
                <div className="text-sm text-[var(--muted)]">{courses.length} cursuri</div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.length === 0 ? (
                  <div className="rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm text-[var(--muted)]">
                    Nu exista cursuri pentru aceste filtre.
                  </div>
                ) : (
                  courses.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => setSelectedId(course.id)}
                      className={cx(
                        "w-full rounded-2xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-md",
                        selectedId === course.id
                          ? "border-[var(--brand)] bg-[#eef8f6]"
                          : "border-[var(--card-border)] bg-white"
                      )}
                    >
                      <div className="label text-[var(--muted)]">{course.category}</div>
                      <div className="mt-2 text-lg font-semibold">{course.title}</div>
                      <div className="mt-2 text-xs text-[var(--muted)]">Profesor: {course.owner.name}</div>
                      <div className="mt-3 text-xs text-[var(--muted)]">
                        Resurse: {course._count.resources} - Comentarii: {course._count.comments}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="panel p-6">
              <div className="label text-[var(--accent)]">Fisa curs</div>
              {!selectedCourse ? (
                <div className="mt-3 text-sm text-[var(--muted)]">
                  Selecteaza un curs din lista pentru a vedea detaliile complete.
                </div>
              ) : (
                <div className="mt-3 space-y-6">
                  <div>
                    <div className="label text-[var(--muted)]">{selectedCourse.category}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl">{selectedCourse.title}</h3>
                      {isOwner && (
                        <button
                          onClick={deleteCourse}
                          disabled={loading}
                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          Sterge cursul
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Profesor: {selectedCourse.owner.name} - Creat: {formatDate(selectedCourse.createdAt)}
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)]">{selectedCourse.description}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Resurse</div>
                      <div className="text-xs text-[var(--muted)]">{selectedCourse.resources.length}</div>
                    </div>

                    <div className="mt-2 space-y-2">
                      {selectedCourse.resources.length === 0 ? (
                        <div className="text-sm text-[var(--muted)]">Nu exista resurse.</div>
                      ) : (
                        selectedCourse.resources.map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-white p-3"
                          >
                            <div>
                              <div className="text-sm font-semibold">{res.title}</div>
                              <div className="text-xs text-[var(--muted)]">
                                {res.type} - {formatDate(res.createdAt)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[var(--card-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[#eef8f6]"
                              >
                                Deschide
                              </a>
                              {isOwner && (
                                <button
                                  onClick={() => deleteResource(res.id)}
                                  disabled={loading}
                                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  Sterge
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {isOwner && (
                      <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-white p-3">
                        <div className="text-sm font-semibold">Adauga resursa</div>
                        <div className="mt-2 grid gap-2">
                          <input
                            value={newResource.title}
                            onChange={(e) => setNewResource((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Titlu resursa"
                            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                          />
                          <select
                            value={newResource.type}
                            onChange={(e) =>
                              setNewResource((prev) => ({ ...prev, type: e.target.value as Resource["type"] }))
                            }
                            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                          >
                            <option value="LINK">Link</option>
                            <option value="PDF">PDF</option>
                            <option value="VIDEO">Video</option>
                          </select>
                          <input
                            value={newResource.url}
                            onChange={(e) => setNewResource((prev) => ({ ...prev, url: e.target.value }))}
                            placeholder="URL"
                            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                          />
                          <button
                            onClick={addResource}
                            disabled={loading}
                            className="rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Adauga resursa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Comentarii</div>
                      <div className="text-xs text-[var(--muted)]">{selectedCourse.comments.length}</div>
                    </div>

                    <div className="mt-2 space-y-2">
                      {selectedCourse.comments.length === 0 ? (
                        <div className="text-sm text-[var(--muted)]">Nu exista comentarii.</div>
                      ) : (
                        selectedCourse.comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-[var(--card-border)] bg-white p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">{comment.user.name}</div>
                              <div className="text-xs text-[var(--muted)]">{formatDate(comment.createdAt)}</div>
                            </div>
                            <div className="mt-2 text-sm text-[var(--muted)]">{comment.content}</div>
                            {user?.id === comment.user.id && (
                              <button
                                onClick={() => deleteComment(comment.id)}
                                disabled={loading}
                                className="mt-2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                              >
                                Sterge
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-white p-3">
                      <div className="text-sm font-semibold">Adauga comentariu</div>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={user ? "Scrie parerea ta..." : "Autentifica-te pentru a comenta"}
                        disabled={!user}
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:opacity-60"
                      />
                      <button
                        onClick={addComment}
                        disabled={loading || !user}
                        className="mt-2 w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        Trimite comentariu
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <div
              className={cx(
                "rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold shadow-xl",
                toast.type === "ok" ? "text-[var(--brand)]" : "text-[var(--accent)]"
              )}
            >
              {toast.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
