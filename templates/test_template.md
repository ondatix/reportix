# {{title}}

**{{office}}**

This test template exercises every block type the renderer supports: parameter substitution in text, six chart types (`bar`, `line`, `pie`, `doughnut`, `scatter`, `pyramid`), the `color` grouping pivot, and the full set of aggregation operations (`count`, `sum`, `mean`, `median`, `min`, `max`, `identity`) across both charts and tables.

---

## 1. Workforce snapshot

### 1.1 Gender distribution (doughnut + color grouping)

```chart
data: Headcount
type: doughnut
color: Gender
title: Gender distribution
caption: Share of staff by gender (row count)
```

### 1.2 Workforce pyramid by pay grade (pyramid)

```chart
data: Headcount
type: pyramid
y: PayGrade
color: Gender
title: Headcount pyramid by pay grade and gender
caption: Staff per pay grade, split left/right by gender
```

### 1.3 Staff per qualification level (bar + color + count)

```chart
data: Headcount
type: bar
x: Level
y: EmployeeID
color: Gender
title: Headcount by qualification level and gender
aggregation:
  y: count
```

### 1.4 Share of leadership tiers (pie)

```chart
data: Headcount
type: pie
color: LeadershipTier
title: Distribution across leadership tiers
```

### 1.5 Summary per pay grade (table with GROUP BY)

```table
data: Headcount
columns:
  - PayGrade
  - EmployeeID
  - FTE
caption: Headcount and average FTE per pay grade
aggregation:
  PayGrade: identity
  EmployeeID: count
  FTE: mean
format:
  FTE: percent
```

---

## 2. Working time and balance

### 2.1 Average FTE by gender (bar + mean)

```chart
data: Headcount
type: bar
x: Gender
y: FTE
color: Gender
title: Average FTE by gender
aggregation:
  y: mean
```

### 2.2 Average parental leave duration (bar + mean, second source)

```chart
data: ParentalLeave
type: bar
x: Gender
y: DurationDays
title: Average parental leave duration (days)
aggregation:
  y: mean
```

### 2.3 Spread of parental leave (table with median)

```table
data: ParentalLeave
columns:
  - Gender
  - DurationDays
caption: Median parental leave duration in days, by gender
aggregation:
  Gender: identity
  DurationDays: median
format:
  DurationDays: integer
```

---

## 3. Applications, hires, and promotions

### 3.1 Applications by qualification level (stacked bar + count)

```chart
data: Applications
type: bar
x: Level
y: ApplicantID
color: Gender
title: Applications by qualification level
stacked: true
aggregation:
  y: count
```

### 3.2 Hires by gender (pie + count)

```chart
data: Hires
type: pie
color: Gender
title: Hires by gender
```

### 3.3 Promotions across leadership tiers (line + color + count)

```chart
data: Promotions
type: line
x: LeadershipTier
y: EmployeeID
color: Gender
title: Promotions by leadership tier
aggregation:
  y: count
```

---

## 4. Performance pay

### 4.1 Average bonus by gender (bar + mean)

```chart
data: PerformancePay
type: bar
x: Gender
y: BonusAmount
title: Average performance bonus
aggregation:
  y: mean
```

### 4.2 FTE vs. bonus amount (scatter)

```chart
data: PerformancePay
type: scatter
x: FTE
y: BonusAmount
color: Gender
title: Performance bonus vs. FTE
```

### 4.3 Totals per pay grade (table with sum + decimal format)

```table
data: PerformancePay
columns:
  - PayGrade
  - BonusAmount
caption: Total performance bonus per pay grade
aggregation:
  PayGrade: identity
  BonusAmount: sum
format:
  BonusAmount: decimal
```

---

## 5. Raw-data sample (table without aggregation)

When the `aggregation` field is omitted, rows render verbatim:

```table
data: Headcount
columns:
  - EmployeeID
  - Gender
  - PayGrade
  - Level
  - LeadershipTier
caption: First records from the Headcount sheet
```

---

::: {.callout-note title='Definitions'}
**FTE** — full-time equivalent, expressed as a fraction of a full workload.
**PayGrade** — internal compensation band.
**LeadershipTier** — management responsibility level.
:::

::: {.callout-tip title='Summary'}
This template walks through every renderer feature. Replace each section with your own narrative for production reports.
:::

---

_Report generated for **{{office}}** — template: `test_template.md`._
