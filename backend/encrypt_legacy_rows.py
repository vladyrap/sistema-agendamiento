"""One-shot: recorre las filas que estaban en plaintext antes de la Wave 3
y las re-guarda para que el TypeDecorator las encripte.

Idempotente: las filas que ya están encriptadas (token Fernet) se saltan.

Uso desde el container backend del VPS:
    docker compose exec backend python encrypt_legacy_rows.py
"""
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.encryption import _looks_like_fernet, encrypt_str


# (tabla, columnas a encriptar)
TARGETS = [
    ("medical_records", ["allergies", "chronic_conditions", "medications", "notes"]),
    ("patient_notes",   ["content"]),
    ("session_logs",    [
        "diagnosis", "evolution", "observations", "indications", "treatment",
        "medications", "next_steps", "emotional_state", "topics_discussed",
        "therapeutic_goals", "progress_notes", "homework",
    ]),
]


def main() -> int:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    db = Session()

    grand_total = 0
    for table, cols in TARGETS:
        for col in cols:
            # Solo las filas NO NULL y NO encriptadas (no empiezan con gAAAA).
            rows = db.execute(text(
                f"SELECT id, {col} FROM {table} "
                f"WHERE {col} IS NOT NULL AND {col} NOT LIKE 'gAAAA%'"
            )).fetchall()

            if not rows:
                print(f"  {table}.{col}: 0 filas legacy")
                continue

            print(f"  {table}.{col}: encriptando {len(rows)} filas…")
            for row_id, value in rows:
                # Re-chequeo por las dudas (carrera entre SELECT y UPDATE)
                if _looks_like_fernet(value):
                    continue
                encrypted = encrypt_str(value)
                db.execute(
                    text(f"UPDATE {table} SET {col} = :v WHERE id = :id"),
                    {"v": encrypted, "id": row_id},
                )
                grand_total += 1
            db.commit()

    print(f"DONE — {grand_total} celdas migradas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
