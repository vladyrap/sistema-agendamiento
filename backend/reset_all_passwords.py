"""Reset MASIVO de passwords: pone TODOS los usuarios con la misma password.

Uso:
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend python reset_all_passwords.py

⚠️ Esto reescribe el password_hash de TODOS los usuarios activos e inactivos.
   Sirve para entornos de testing y QA. NO USAR en producción real con usuarios reales.
"""
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


NEW_PASSWORD = "Inicio01.."


def reset_all():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("No hay usuarios en la BD.")
            return

        new_hash = get_password_hash(NEW_PASSWORD)
        for u in users:
            u.password_hash = new_hash
        db.commit()

        # Resumen
        from collections import Counter
        roles = Counter(
            (u.role.value if hasattr(u.role, "value") else str(u.role))
            for u in users
        )

        print("─" * 60)
        print(f"  ✓ Password reseteada a `{NEW_PASSWORD}` para {len(users)} usuarios")
        print("─" * 60)
        for role, count in sorted(roles.items()):
            print(f"  · {role:<20} {count:>4} usuarios")
        print("─" * 60)
        print()
        print(f"🔑 Password de TODOS los usuarios:  {NEW_PASSWORD}")
        print()
        print("Para probar:")
        print("  - admin@clinica.cl / Inicio01..")
        print("  - dr.garcia@clinica.cl / Inicio01..")
        print("  - paciente@ejemplo.cl / Inicio01..")
        print("  - cualquier otro email del sistema → misma password")
        print()
    finally:
        db.close()


if __name__ == "__main__":
    reset_all()
