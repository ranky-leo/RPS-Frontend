import { formatRac, formatRafc } from "../../lib/currency";
import type { ShopPaymentCurrency } from "../../lib/types";

type ShopPriceAmountProps = {
  amount: number;
  currency?: ShopPaymentCurrency;
  className?: string;
};

export function ShopPriceAmount({
  amount,
  currency = "usdt",
  className = "",
}: ShopPriceAmountProps) {
  if (currency === "rac") {
    return (
      <span
        className={`shopPriceAmount shopPriceAmountRac${className ? ` ${className}` : ""}`}
      >
        <span>{formatRafc(amount)}</span>
      </span>
    );
  }

  return (
    <span
      className={`shopPriceAmount shopPriceAmountUsdt${className ? ` ${className}` : ""}`}
    >
      <img
        className="shopPriceAmountIcon"
        src="/rac-amount-icon.png"
        alt=""
        aria-hidden="true"
      />
      <span>{formatRac(amount)}</span>
    </span>
  );
}

/** @deprecated Use ShopPriceAmount with an explicit currency instead. */
export function ShopRacAmount({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  return (
    <ShopPriceAmount amount={amount} currency="rac" className={className} />
  );
}
