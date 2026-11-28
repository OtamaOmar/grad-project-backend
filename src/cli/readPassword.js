import { createInterface } from "node:readline";

// Asks for the password without showing what is typed.
// When input is piped (not a terminal), it takes the first line instead.
export function readPassword(prompt) {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    return new Promise((resolve) =>
      rl.once("line", (line) => (rl.close(), resolve(line))),
    );
  }
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl._writeToOutput = (text) => {
      // Node has no public "hide input" option, so we override how readline echoes:
      // the prompt is shown, the typed characters are not.
      if (text.includes(prompt)) process.stdout.write(text);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}
