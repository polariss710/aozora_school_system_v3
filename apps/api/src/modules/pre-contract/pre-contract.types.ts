export type ListQuotesQuery = { status?: unknown; keyword?: unknown; limit?: unknown };

export type QuoteCourseBody = {
  name?: unknown;
  content?: unknown;
  hoursPerSession?: unknown;
  weeklyFrequency?: unknown;
  unitPriceJpy?: unknown;
};

export type QuoteWriteBody = {
  prospectiveStudentName?: unknown;
  prospectiveStudentMemo?: unknown;
  title?: unknown;
  courseTrack?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  exchangeRate?: unknown;
  note?: unknown;
  courses?: unknown;
};
