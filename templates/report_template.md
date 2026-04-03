# {{department}} Report — {{period}}

This report summarizes key metrics for the **{{department}}** department during **{{period}}**.

## Revenue Overview

```chart
data: sales
x: month
y: revenue
type: bar
title: Monthly Revenue
caption: Revenue by month for the selected period
```

## Detailed Numbers

```table
data: sales
columns: [month, revenue, growth]
format:
  revenue: currency
  growth: percent
caption: Monthly revenue and growth figures
```

## Summary

The data above reflects the performance of the {{department}} team. Please review and reach out with any questions.
