CREATE TABLE "lookup_counts" (
	"day" date NOT NULL,
	"cohort" text NOT NULL,
	"outcome" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "lookup_counts_day_cohort_outcome_pk" PRIMARY KEY("day","cohort","outcome")
);
