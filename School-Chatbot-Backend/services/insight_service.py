from datetime import datetime, timedelta

import runtime
from db import get_db


def get_insights(days: int, current_user: dict):
    period_days = max(1, min(days, 365))
    cutoff = (datetime.now() - timedelta(days=period_days)).isoformat()
    conn = get_db()
    try:
        message_rows = conn.execute(
            """
            SELECT m.id, m.text, m.category, m.confidence
            FROM messages m
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
            ORDER BY m.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        for row in message_rows:
            existing = conn.execute(
                "SELECT COUNT(*) AS count FROM message_categories WHERE message_id = ?",
                (row["id"],),
            ).fetchone()
            if not existing or int(existing["count"] or 0) == 0:
                classifications = runtime.classify_question_intents(row["text"])
                runtime.save_message_categories(conn, row["id"], classifications)
                primary = next(
                    (item for item in classifications if item.get("category") != "범위밖"),
                    classifications[0] if classifications else None,
                )
                if primary:
                    conn.execute(
                        "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
                        (
                            runtime.normalize_insight_category(primary.get("category")),
                            float(primary.get("confidence") or 0.0),
                            row["id"],
                        ),
                    )

        rows = conn.execute(
            """
            SELECT mc.category, mc.confidence, mc.intent_text, m.text
            FROM message_categories mc
            JOIN messages m ON m.id = mc.message_id
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
            ORDER BY mc.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        counts = {}
        confidence_sum = {}
        for row in rows:
            category = runtime.normalize_insight_category(row["category"])
            if category == "범위밖":
                continue
            counts[category] = counts.get(category, 0) + 1
            confidence_sum[category] = confidence_sum.get(category, 0.0) + float(row["confidence"] or 0.0)

        if message_rows:
            conn.commit()

        total = sum(counts.values())
        categories = []
        for category, count in sorted(counts.items(), key=lambda item: item[1], reverse=True):
            percent = round((count / total) * 100) if total else 0
            avg_confidence = round(confidence_sum.get(category, 0.0) / count, 2) if count else 0.0
            categories.append({
                "name": category,
                "count": count,
                "percent": percent,
                "confidence": avg_confidence,
            })

        top_category = categories[0] if categories else None
        top_name = top_category["name"] if top_category else "기타"

        return {
            "period_days": period_days,
            "total": total,
            "daily_average": round(total / period_days, 1),
            "topic_count": len(categories),
            "categories": categories,
            "top_category": top_category,
            "recommendation": runtime.build_insight_recommendation(top_name),
        }
    finally:
        conn.close()


def get_insight_recommendation(days: int, current_user: dict):
    period_days = max(1, min(days, 365))
    cutoff = (datetime.now() - timedelta(days=period_days)).isoformat()
    conn = get_db()
    try:
        rows = conn.execute(
            """
            SELECT mc.category, mc.intent_text, m.text
            FROM message_categories mc
            JOIN messages m ON m.id = mc.message_id
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
              AND mc.category != '범위밖'
            ORDER BY mc.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        if not rows:
            message_rows = conn.execute(
                """
                SELECT m.id, m.text
                FROM messages m
                JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.user_id = ?
                  AND m.role = 'user'
                  AND m.created_at >= ?
                ORDER BY m.id ASC
                """,
                (current_user["id"], cutoff),
            ).fetchall()
            for row in message_rows:
                classifications = runtime.classify_question_intents(row["text"])
                runtime.save_message_categories(conn, row["id"], classifications)
            if message_rows:
                conn.commit()
            rows = conn.execute(
                """
                SELECT mc.category, mc.intent_text, m.text
                FROM message_categories mc
                JOIN messages m ON m.id = mc.message_id
                JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.user_id = ?
                  AND m.role = 'user'
                  AND m.created_at >= ?
                  AND mc.category != '범위밖'
                ORDER BY mc.id ASC
                """,
                (current_user["id"], cutoff),
            ).fetchall()

        counts = {}
        questions_by_category = {}
        for row in rows:
            category = runtime.normalize_insight_category(row["category"])
            counts[category] = counts.get(category, 0) + 1
            questions_by_category.setdefault(category, []).append(row["intent_text"] or row["text"])

        top_name = max(counts.items(), key=lambda item: item[1])[0] if counts else "기타"
        recommendation = runtime.generate_insight_recommendation(
            top_name,
            questions_by_category.get(top_name, []),
        )
        return {
            "period_days": period_days,
            "topic": recommendation.get("topic", top_name),
            "blurb": recommendation.get("blurb", ""),
            "questions": recommendation.get("questions", []),
            "source": recommendation.get("source", "fallback"),
            "reason": recommendation.get("reason", ""),
        }
    finally:
        conn.close()
