export const CURRENCY_LABEL = "USDT";
export const FREE_CURRENCY_LABEL = "RAC";

export const formatRac = (value: number) => {
  const amount = Math.abs(Number(value) || 0);
  const decimals = amount % 1 === 0 ? 0 : 2;
  return `${amount.toFixed(decimals)} ${CURRENCY_LABEL}`;
};

export const formatSignedRac = (value: number) => {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatRac(amount)}`;
};

export const formatRafc = (value: number) => {
  const amount = Math.abs(Number(value) || 0);
  const decimals = amount % 1 === 0 ? 0 : 2;
  return `${amount.toFixed(decimals)} ${FREE_CURRENCY_LABEL}`;
};

export const formatSignedRafc = (value: number) => {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatRafc(amount)}`;
};

export const getWithdrawNetFeeMessage = (
  netFee: number | null | undefined,
  grossAmount?: number,
) => {
  const fee = Number(netFee);
  if (!Number.isFinite(fee) || fee < 0) {
    return "Loading withdrawal net fee...";
  }

  const feeLabel = formatRac(fee);
  const base = `When you withdraw, your amount is reduced by a ${feeLabel} net fee for transaction gas.`;

  if (
    grossAmount == null ||
    !Number.isFinite(grossAmount) ||
    grossAmount <= 0
  ) {
    return base;
  }

  const net = Math.max(0, grossAmount - fee);
  if (net <= 0) {
    return `${base} Enter an amount greater than ${feeLabel} to withdraw.`;
  }

  return `${base} You will receive ${net} USDT.`;
};
