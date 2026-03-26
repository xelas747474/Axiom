import {
  authenticateRequest,
  getAllUsers,
  deleteUser,
  sanitizeUser,
} from "@/lib/auth-server";

// GET /api/admin/users — list all users (admin only)
export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }

    const users = await getAllUsers();
    return Response.json({
      users: users.map(sanitizeUser),
      count: users.length,
      max: 10,
    });
  } catch (err) {
    console.error("Admin list users error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users — delete a user (admin only)
export async function DELETE(request: Request) {
  try {
    const admin = await authenticateRequest(request);
    if (!admin || admin.role !== "admin") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return Response.json({ error: "ID utilisateur requis" }, { status: 400 });
    }

    if (userId === admin.id) {
      return Response.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 }
      );
    }

    const deleted = await deleteUser(userId);
    if (!deleted) {
      return Response.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
