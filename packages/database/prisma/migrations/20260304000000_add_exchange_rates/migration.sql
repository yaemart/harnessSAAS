-- CreateTable
CREATE TABLE "ExchangeRateConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiUrl" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateDailySnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateMonthlyAvg" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "avgRate" DOUBLE PRECISION NOT NULL,
    "minRate" DOUBLE PRECISION NOT NULL,
    "maxRate" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateMonthlyAvg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRateDailySnapshot_date_idx" ON "ExchangeRateDailySnapshot"("date");

-- CreateIndex
CREATE INDEX "ExchangeRateDailySnapshot_targetCurrency_idx" ON "ExchangeRateDailySnapshot"("targetCurrency");

-- CreateIndex
CREATE INDEX "ExchangeRateDailySnapshot_baseCurrency_targetCurrency_idx" ON "ExchangeRateDailySnapshot"("baseCurrency", "targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRateDailySnapshot_date_baseCurrency_targetCurrency_key" ON "ExchangeRateDailySnapshot"("date", "baseCurrency", "targetCurrency");

-- CreateIndex
CREATE INDEX "ExchangeRateMonthlyAvg_year_month_idx" ON "ExchangeRateMonthlyAvg"("year", "month");

-- CreateIndex
CREATE INDEX "ExchangeRateMonthlyAvg_targetCurrency_idx" ON "ExchangeRateMonthlyAvg"("targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRateMonthlyAvg_year_month_baseCurrency_targetCurren_key" ON "ExchangeRateMonthlyAvg"("year", "month", "baseCurrency", "targetCurrency");
