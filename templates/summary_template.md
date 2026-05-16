# {{title}} — Executive Summary

**{{office}}**

A condensed snapshot of the headline workforce indicators for the current reporting period. For the full breakdown, see the standard report.

---

## Headline figures

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

## Composition

```chart
data: Headcount
type: doughnut
color: Gender
title: Gender composition
caption: Share of staff by gender
```

## Headcount by qualification level

```chart
data: Headcount
type: bar
x: Level
y: EmployeeID
color: Gender
title: Staff by qualification level and gender
aggregation:
  y: count
```

---

::: {.callout-tip title='Takeaway'}
Replace this callout with the single most important conclusion of the reporting period — the one figure or trend stakeholders should remember.
:::

::: {.callout-warning title='Caveat'}
Headline figures exclude vacant positions and contractors. See the standard report for the full population definition.
:::

---

_Generated for **{{office}}** — template: `summary_template.md`._
