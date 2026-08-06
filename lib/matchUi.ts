export const MOVE_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "🖐️",
  scissors: "✌️",
};

export const resolveRoundWinner = (
  leftMove?: string | null,
  rightMove?: string | null,
) => {
  if (!leftMove || !rightMove || leftMove === rightMove) {
    return null;
  }

  if (
    (leftMove === "rock" && rightMove === "scissors") ||
    (leftMove === "paper" && rightMove === "rock") ||
    (leftMove === "scissors" && rightMove === "paper")
  ) {
    return "left";
  }

  return "right";
};
