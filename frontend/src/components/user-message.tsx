import { term } from "@/lib/bn";
import { decodeFormMessage } from "@/lib/form-message";

export function UserMessage({ text }: { text: string }) {
  const { label, answers } = decodeFormMessage(text);
  const entries = Object.entries(answers);
  return (
    <div className="user-row">
      <div className="user-bubble">
        <p>{label}</p>
        {entries.length > 0 && (
          <dl className="form-chips">
            {entries.map(([k, v]) => (
              <div key={k} className="form-chip">
                <dt>{term(k).replaceAll("_", " ")}</dt>
                <dd>{term(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
