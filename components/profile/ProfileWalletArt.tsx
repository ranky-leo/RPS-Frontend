type ProfileWalletArtProps = {
  variant: "deposit" | "withdraw" | "history" | "profile";
};

const ART_SRC = {
  deposit: "/deposit.png",
  withdraw: "/withdraw.png",
  history: "/history.png",
  profile: "/profile.png",
} as const;

const ART_CLASS_SUFFIX = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  history: "History",
  profile: "Profile",
} as const;

export function ProfileWalletArt({ variant }: ProfileWalletArtProps) {
  return (
    <div
      className={`profileWalletArt profileWalletArt${ART_CLASS_SUFFIX[variant]}`}
      aria-hidden="true"
    >
      <img
        className="profileWalletArtImage"
        src={ART_SRC[variant]}
        alt=""
      />
    </div>
  );
}
