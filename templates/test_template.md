# {{title}}

**{{office}}**

Dieses Testtemplate führt jeden vom Renderer unterstützten Block einmal aus: Parametersubstitution im Text, sechs Diagrammtypen (`bar`, `line`, `pie`, `doughnut`, `scatter`, `pyramid`), die `color`-Gruppierung sowie Aggregationen (`count`, `sum`, `mean`, `median`, `min`, `max`, `identity`) in Diagrammen und Tabellen.

---

## 1. Personalbestand zum Stichtag

### 1.1 Geschlechterverteilung (doughnut + color grouping)

```chart
data: Stichtag
type: doughnut
color: Geschlecht
title: Geschlechterverteilung
caption: Anteil der Beschäftigten nach Geschlecht (Zeilenzählung)
```

### 1.2 Personalpyramide nach Entgeltgruppe (pyramid)

```chart
data: Stichtag
type: pyramid
y: Entgeltgruppe / Besoldungsgruppe
color: Geschlecht
title: Personalpyramide nach Entgeltgruppe und Geschlecht
caption: Beschäftigte je Entgeltgruppe, links/rechts nach Geschlecht
```

### 1.3 Beschäftigte je Qualifikationsebene (bar + color + count)

```chart
data: Stichtag
type: bar
x: QE
y: PersNr
color: Geschlecht
title: Beschäftigte nach Qualifikationsebene und Geschlecht
aggregation:
  y: count
```

### 1.4 Anteile nach Führungsebene (pie + color + count)

```chart
data: Stichtag
type: pie
color: Führungsebene
title: Verteilung der Führungsebenen
```

### 1.5 Übersicht je Entgeltgruppe (table mit GROUP BY)

```table
data: Stichtag
columns:
  - Entgeltgruppe / Besoldungsgruppe
  - PersNr
  - Arbeitszeitanteil
caption: Anzahl Beschäftigte und durchschnittlicher Arbeitszeitanteil je Entgeltgruppe
aggregation:
  Entgeltgruppe / Besoldungsgruppe: identity
  PersNr: count
  Arbeitszeitanteil: mean
format:
  Arbeitszeitanteil: percent
```

---

## 2. Arbeitszeit & Vereinbarkeit

### 2.1 Durchschnittlicher Arbeitszeitanteil nach Geschlecht (bar + mean)

```chart
data: Stichtag
type: bar
x: Geschlecht
y: Arbeitszeitanteil
color: Geschlecht
title: Durchschnittlicher Arbeitszeitanteil nach Geschlecht
aggregation:
  y: mean
```

### 2.2 Durchschnittliche Elternzeit (bar + mean, eigene Datenquelle)

```chart
data: Zeitraum_Beurlaubung
type: bar
x: Geschlecht
y: Dauer der Elternzeit (Tage)
title: Durchschnittliche Dauer der Elternzeit (Tage)
aggregation:
  y: mean
```

### 2.3 Streuung der Elternzeit (table mit min / median / max)

```table
data: Zeitraum_Beurlaubung
columns:
  - Geschlecht
  - Dauer der Elternzeit (Tage)
caption: Verteilung der Elternzeitdauer in Tagen — Median je Geschlecht
aggregation:
  Geschlecht: identity
  Dauer der Elternzeit (Tage): median
format:
  Dauer der Elternzeit (Tage): integer
```

---

## 3. Bewerbungen, Einstellungen und Beförderungen

### 3.1 Bewerbungen nach Qualifikationsebene (bar + count)

```chart
data: Zeitraum_Bewerbung
type: bar
x: QE
y: BewerberID
color: Geschlecht
title: Bewerbungen je Qualifikationsebene
stacked: true

aggregation:
  y: count
```

### 3.2 Einstellungen nach Geschlecht (pie + count)

```chart
data: Zeitraum_Einstellung
type: pie
color: Geschlecht
title: Einstellungen nach Geschlecht
```

### 3.3 Beförderungen nach Führungsebene (line + color + count)

```chart
data: Zeitraum_Befoerderung
type: line
x: Führungsebene
y: PersNr
color: Geschlecht
title: Beförderungen nach Führungsebene
aggregation:
  y: count
```

---

## 4. Leistungskomponenten

### 4.1 Mittlere Leistungskomponente nach Geschlecht (bar + mean)

```chart
data: Zeitraum_Leistungskomponente
type: bar
x: Geschlecht
y: Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
title: Durchschnittliche Höhe der Leistungskomponente
stacked: true
aggregation:
  y: count
```

### 4.2 Streudiagramm Arbeitszeitanteil ↔ Leistungskomponente (scatter)

```chart
data: Zeitraum_Leistungskomponente
type: scatter
x: Arbeitszeitanteil
y: Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
color: Geschlecht
title: Leistungskomponente in Abhängigkeit vom Arbeitszeitanteil
```

### 4.3 Summe je Entgeltgruppe (table mit sum + min + max)

```table
data: Zeitraum_Leistungskomponente
columns:
  - Entgeltgruppe / Besoldungsgruppe
  - Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
caption: Summe, Minimum und Maximum der Leistungskomponente je Entgeltgruppe
aggregation:
  Entgeltgruppe / Besoldungsgruppe: identity
  Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB): sum
format:
  Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB): decimal
```

---

## 5. Rohdatenausschnitt (Tabelle ohne Aggregation)

Wenn das Feld `aggregation` weggelassen wird, werden die Zeilen unverändert ausgegeben:

```table
data: Stichtag
columns:
  - PersNr
  - Geschlecht
  - Entgeltgruppe / Besoldungsgruppe
  - QE
  - Führungsebene
caption: Erste Datensätze des Stichtag-Sheets
```

---

_Bericht erstellt für **{{office}}** — Vorlage: `test_template.md`._
