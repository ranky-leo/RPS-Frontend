export type MatchLedger = "rac" | "free";

export type Price = 1 | 2 | 5 | 10 | 20;

export type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text?: string | null;
  imageUrl?: string | null;
  sticker?: string | null;
  createdAt: number;
};

export type DailyMissionItem = {
  id: number;
  missionKey: string;
  content: string;
  required: number;
  reward: number;
  rewardRac?: number;
  rewardUsdt?: number;
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
  isMeta: boolean;
  sortOrder: number;
  discordChannelMode?: "join" | "visit";
  discordChannelJoined?: boolean;
  discordChannelStatus?: "not_joined" | "joined";
  discordChannelMessage?: string;
};

export type DailyMissionsResponse = {
  cycleKey: string;
  resetAt: number;
  resetTimeZone: string;
  discordChannelStatus?: {
    status: "not_joined" | "joined";
    mode: "join" | "visit";
    joined: boolean;
    message: string;
  } | null;
  missions: DailyMissionItem[];
  totalMissions?: DailyMissionItem[];
};

export type NewsWinner = {
  rank: number;
  user_id?: string | null;
  username: string;
  avatar: string;
  reward: number;
  rewardUsdt?: number;
  rewardRac?: number;
};

export type NewsWinnersMeta = {
  schema_version: number;
  count: number;
  rank_range: {
    min: number;
    max: number;
  };
};

export type News = {
  id: string;
  type?: "season_winner" | "admin_news";
  season_id?: string | null;
  title: string;
  /** Intro message or HTML fallback */
  content: string;
  image?: string | null;
  winners?: NewsWinner[];
  winners_meta?: NewsWinnersMeta;
  active?: boolean;
  hidden: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ActiveNewsResponse = {
  type: "season_winner" | "admin_news" | null;
  items: News[];
};

export type ShopPurchaseResult = {
  user: User;
  avatars?: ShopAvatarOption[];
  names?: ShopNameOption[];
};

export type AvatarMoveEffectSet = {
  stoneGif: string;
  scissorsGif: string;
  paperGif: string;
};

export type AvatarMoveKey = "stone" | "scissors" | "paper";

export type ShopPaymentCurrency = "usdt" | "rac";

export type ShopAvatarOption = {
  id: string;
  label: string;
  imageUrl: string;
  priceRac: number;
  currencyType: ShopPaymentCurrency;
  stoneGif: string;
  scissorsGif: string;
  paperGif: string;
  owned: boolean;
  equipped?: boolean;
};

export type ShopNameOption = {
  id: string;
  name: string;
  priceRac: number;
  owned: boolean;
  taken?: boolean;
  equipped?: boolean;
};

export type User = {
  id: string;
  mail: string;
  username: string;
  avatar: string;
  refer?: string | null;
  inviter_username?: string | null;
  inviter_avatar?: string | null;
  balance_usdt: number;
  balance_rac: number;
  balance_rank?: number;
  has_password?: boolean;
  onboarding_complete?: boolean;
  type?: string;
  lockedBalance: number;
  discord_id?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  discord_avatar?: string | null;
  discord_linked_at?: string | null;
  discord_invite_clicked_at?: string | null;
  is_marketing?: boolean;
  marketing_region?: string;
  created_at?: string;
  createdAt?: string;
};

export type BalanceHistoryItem = {
  id: string;
  status: string;
  amount: number;
  balance: number;
  previousBalance?: number;
  updatedBalance?: number;
  createdAt: string;
  hashlink?: string | null;
  txHash?: string | null;
  network?: string | null;
  ledger?: "rac" | "free";
};

export type UserMatchHistoryItem = {
  id: string;
  price: number;
  ledger: "rac" | "free";
  won: boolean;
  opponentUsername: string;
  opponentAvatar: string;
  myScore: number;
  opponentScore: number;
  payout: number;
  finishedAt: number;
};

export type Match = {
  id: string;
  createdAt?: string;
  price: Price;
  ledger?: MatchLedger;
  userId1: string;
  userId2: string | null;
  username1: string | null;
  username2: string | null;
  avatar1?: string | null;
  avatar2?: string | null;
  inviterUserId1?: string | null;
  inviterUserId2?: string | null;
  inviterUsername1?: string | null;
  inviterUsername2?: string | null;
  inviterAvatar1?: string | null;
  inviterAvatar2?: string | null;
  score1: number;
  score2: number;
  winnerUserId: string | null;
  winnerPayout?: number;
  state: "waiting" | "playing" | "finished";
  stage: string;
  warningTarget?: "player1" | "player2" | "both" | null;
  roundNumber: number;
  countdownEndsAt: number | null;
  round: {
    move1: "rock" | "paper" | "scissors" | null;
    move2: "rock" | "paper" | "scissors" | null;
    revealed: boolean;
  } | null;
  stakeTotal: number;
  feeTotal: number;
  isVirtual?: boolean;
  isOnboarding?: boolean;
};

export type RematchChoice = "continue" | "quit" | null;

export type RematchState = {
  sessionId: string;
  finishedMatchId: string;
  price: Price;
  ledger: MatchLedger;
  userId1: string;
  userId2: string;
  choices: Record<string, RematchChoice>;
  pendingQuitUserId: string | null;
  botUserId: string | null;
  botLossStreak: number;
  playerDisplay?: Record<
    string,
    { username?: string | null; avatar?: string | null }
  >;
  canContinueByUser: Record<string, boolean>;
  viewerUserId?: string;
};

export type LobbySnapshot = {
  subscribers: number;
  currentlyPlaying: number;
  matchCount: { price: Price; ledger?: MatchLedger; count: number }[];
  houseBalance: number;
  winnerShareRate?: number;
  winnerSharePercent?: string;
  systemFeeRate?: number;
  referFeeRate?: number;
  netWithdrawFee?: number;
  systemFeePercent?: string;
  referFeePercent?: string;
  totalServiceFeePercent?: string;
  virtualEnabled?: boolean;
  matchesInProgress?: number;
  activeSearchers?: number;
  matchesPlayedToday?: number;
  lastMatchFinishedAt?: number | null;
  matchesCompletedLast10s?: number;
  fastestMatchTodaySeconds?: number | null;
  peakActivityLabel?: string | null;
  activityFeed?: {
    id: string;
    text: string;
    at: number;
  }[];
  recentWinners?: {
    id: string;
    userId: string;
    username: string;
    avatar?: string | null;
    defeatedUsername?: string;
    matchPrice?: number;
    payout?: number;
    streak?: number;
    ledger?: MatchLedger;
    createdAt?: number;
    at?: number;
  }[];
  recentAuthEvents?: {
    id: string;
    userId: string;
    username: string;
    avatar?: string | null;
    action: string;
    createdAt?: number;
    at?: number;
  }[];
  dailyStories?: unknown[];
  dailyHighlights?: unknown;
};

export type ReactionMediaItem = {
  videoSrc: string;
  posterSrc: string;
  videoReady: boolean;
  cacheVersion?: string | null;
};

export type ReactionMediaBundle = {
  winner: ReactionMediaItem;
  loser: ReactionMediaItem;
  cacheVersion?: string | null;
};

export type SeasonalRankRewardType = "paid" | "free" | "none";

export type SeasonRewardAmounts = {
  usdt: number;
  rac: number;
};

export type SeasonalRankEntry = {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  rp: number;
  rewardUsdt: number;
  rewardRac: number;
  rewardAmount: number;
  rewardType: SeasonalRankRewardType;
};

export type SeasonalRankViewer = Omit<SeasonalRankEntry, "rank"> & {
  rank: number | null;
};

export type SeasonalRankCompletedWinner = {
  rank: number;
  userId: string | null;
  username: string;
  avatar: string;
  rewardUsdt: number;
  rewardRac: number;
  rewardAmount: number;
  rewardType: SeasonalRankRewardType;
};

export type SeasonalRankCompletedSeason = {
  id: string;
  seasonNumber: number;
  startAt: number;
  endAt: number;
  winners: SeasonalRankCompletedWinner[];
};

export type SeasonalRankResponse = {
  activeSetting: "on" | "off";
  seasonActive: boolean;
  seasonKey: string;
  seasonNumber: number;
  startAt: number | null;
  endAt: number | null;
  resetAt: number | null;
  pendingStartAt: number | null;
  resetTimeZone: string;
  rewardsByRank: Record<string, SeasonRewardAmounts>;
  topTen: SeasonalRankEntry[];
  hasMoreRankedPlayers?: boolean;
  completedSeasons: SeasonalRankCompletedSeason[];
  viewer: SeasonalRankViewer | null;
};

export type UserFeedbackItem = {
  id: string;
  userId: string;
  username: string;
  subject: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  rewardAmount: number;
  rewardTransactionId: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
