type MatchTypeBattleArtProps = {
  className?: string;
};

export function MatchTypeBattleArt({ className }: MatchTypeBattleArtProps) {
  return (
    <div className={className} aria-hidden="true">
      <div className="matchTypeBattleRing">
        <span className="matchTypeBattleMove matchTypeBattleMove--free">✊</span>
        <span className="matchTypeBattleVs">VS</span>
        <span className="matchTypeBattleMove matchTypeBattleMove--paid">✌️</span>
      </div>
    </div>
  );
}
