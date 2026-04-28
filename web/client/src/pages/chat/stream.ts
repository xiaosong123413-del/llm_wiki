interface SseMessage {
  event: string;
  data: string;
}

export function parseSseMessages(buffer: string): { messages: SseMessage[]; rest: string } {
  const parts = buffer.split(/\n\n/);
  const rest = parts.pop() ?? "";
  const messages = parts
    .map(parseSseMessage)
    .filter((message): message is SseMessage => message !== null);

  return { messages, rest };
}

function parseSseMessage(block: string): SseMessage | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}
