/**
 * ResponseDisplay - Display APDU response
 */

interface ResponseDisplayProps {
  response: string;
}

export function ResponseDisplay({ response }: ResponseDisplayProps) {
  return (
    <section className="response-section">
      <h2>Response</h2>
      <pre>{response}</pre>
    </section>
  );
}
