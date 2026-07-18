import os
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


def is_homework(title: str, content: str) -> bool:
    """Returns True if the classroom post looks like homework/assignment."""
    prompt = f"""You are a school assistant. Decide whether the following classroom post is a homework assignment or task that students must complete and submit.

Title: {title or '(no title)'}
Content: {content or '(no content)'}

Reply with only one word: YES or NO."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = message.content[0].text.strip().upper()
        return answer.startswith("YES")
    except Exception:
        return False
