# {{title}}

**{{office}}**
<!-- 
::: {.callout-note title='Über dieses Dokument'}
Diese Vorlage wurde aus der `Steckbrief-Daten.csv` der Quarto-Referenzimplementierung (`main.qmd`) übertragen. Jede Frage des Konzepts wird durch ein Diagramm beantwortet; die Konfiguration für Datenquelle, Gruppierung, Aggregation und Personenkreis ist im jeweiligen YAML-Block hinterlegt.

Datenschutz ist global aktiv (siehe `config.yaml → data_protection.smallest_group`). Aggregierte Werte unterhalb des Schwellwerts werden in Tabellen als `<5` und in Diagrammen mit gekapptem Balken plus maskiertem Tooltip dargestellt.
::: -->

## Einleitung

Gemäß Art. 3 Abs. 2 GG bzw. Art. 118 Abs. 2 BV ist jede Dienststelle verpflichtet, die Gleichstellung von Frauen und Männern zu fördern und bestehende Benachteiligungen abzubauen. Zur Umsetzung der Gleichstellung von Frauen und Männern gibt das Bayerische Gleichstellungsgesetz (BayGlG) Rahmenbedingungen vor. Gemäß Art. 4 ff. BayGlG erstellen die Dienststellen Gleichstellungskonzepte als wesentliches Steuerungselement.

Gemäß Art. 13 BayGlG bestellt jede Dienststelle eine oder einen Gleichstellungsbeauftragten sowie eine Stellvertretung. Die Gleichstellungsbeauftragten fördern und überwachen den Vollzug des BayGlG und des Gleichstellungskonzepts und unterstützen die Dienststellenleitung bei deren Umsetzung.

## Situationsbeschreibung

### Gesamtübersicht

::: {.callout-note title='Definitionen'}
**Geschlecht:** Im Datensatz wird zwischen den Ausprägungen unterschieden, die das Personalverwaltungssystem führt.

**Entgeltgruppe / Besoldungsgruppe:** Eingruppierung im Tarifvertrag bzw. der bayerischen Besoldungsordnung.

**QE (Qualifikationsebene):** Laufbahngruppen 1–4 nach Art. 5 LlbG; entspricht im Tarifbereich näherungsweise den E-Gruppen.

**Organisationseinheit:** Referat / Sachgebiet / Amt — je nach Verwaltungsebene unterschiedlich tief gegliedert.
:::

#### Wie viele Männer und Frauen arbeiten bei uns?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: pie
y: Geschlecht
color: Geschlecht
title: Geschlechterverteilung
filter: Alle
aggregation:
  y: share_total
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen arbeiten in den Organisationseinheiten?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Organisationseinheit
y: Organisationseinheit
color: Geschlecht
title: Männer und Frauen in den Organisationseinheiten
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind Tarifbeschäftigte bzw. Beamte?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
stacked: true
x: Beamte / Tarifbeschäftigte
y: Beamte / Tarifbeschäftigte
color: Geschlecht
title: Tarifbeschäftigte vs. Beamte
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen haben befristete bzw. unbefristete Arbeitsverhältnisse?
> Datenquelle: PVS · Personenkreis: Tarifbeschäftigte · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
stacked: true
x: Befristet / Unbefristet
y: Befristet / Unbefristet
color: Geschlecht
title: Befristete vs. unbefristete Arbeitsverhältnisse
filter: Tarifbeschäftigte
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind in den Entgelt-/Besoldungsgruppen?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Entgeltgruppe / Besoldungsgruppe
y: Entgeltgruppe / Besoldungsgruppe
color: Geschlecht
title: Männer und Frauen in den Entgelt- und Besoldungsgruppen
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind in welcher Qualifikationsebene?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: QE
color: Geschlecht
title: Qualifikationsebenen nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind in welcher QE verglichen zur Einstiegs-QE?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: QE-Aufstieg
color: Geschlecht
title: QE-Aufstieg im Vergleich zur Einstiegs-QE
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind Auszubildende?
> Datenquelle: PVS · Personenkreis: Auszubildende · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
x: Ausbildungsbereich
y: Ausbildungsbereich
color: Geschlecht
title: Auszubildende in den Ausbildungsbereichen
filter: Auszubildende
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Übersicht: Anzahl und Anteil je Entgeltgruppe (Tabelle)
> Aggregierte Tabelle mit Beschäftigtenzahl und Anteil am Gesamtbestand je Entgeltgruppe. Werte unter dem Datenschutzschwellwert erscheinen als `<5`.

```table
data: Stichtag
columns:
  - Entgeltgruppe / Besoldungsgruppe
  - PersNr
  - Geschlecht
caption: Beschäftigte je Entgeltgruppe — Anzahl und Anteil am Gesamtbestand
aggregation:
  Entgeltgruppe / Besoldungsgruppe: identity
  PersNr: count
  Geschlecht: share_total
format:
  Geschlecht: decimal
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Bewerbungen und Einstellungen

::: {.callout-note title='Definitionen'}
**Qualifizierte Bewerbung:** Eine Bewerbung, die die formalen und fachlichen Mindestanforderungen erfüllt.

**Einstellung:** Begründung eines Beschäftigungs- oder Beamtenverhältnisses im Berichtszeitraum.

**Intern / Extern:** Internbewerbung aus der eigenen Dienststelle bzw. Bewerbung von außerhalb.
:::

#### Wie viele qualifizierte Bewerbungen gehen je QE ein?
> Datenquelle: Bewerbungsmanagement-Software · Personenkreis: Qualifizierte Bewerbungen · Datensatz: Zeitraum_Bewerbung

```chart
data: Zeitraum_Bewerbung
type: pyramid
y: QE
color: Geschlecht
title: Qualifizierte Bewerbungen nach Qualifikationsebene
filter: Qualifizierte Bewerbungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele qualifizierte Bewerbungen gehen je Führungsebene ein?
> Datenquelle: Bewerbungsmanagement-Software · Personenkreis: Qualifizierte Bewerbungen · Datensatz: Zeitraum_Bewerbung

```chart
data: Zeitraum_Bewerbung
type: pyramid
y: Führungsebene
color: Geschlecht
title: Qualifizierte Bewerbungen je Führungsebene
filter: Qualifizierte Bewerbungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele interne und externe qualifizierte Bewerbungen?
> Datenquelle: Bewerbungsmanagement-Software · Personenkreis: Qualifizierte Bewerbungen · Datensatz: Zeitraum_Bewerbung

```chart
data: Zeitraum_Bewerbung
type: pyramid
y: Intern / Extern
color: Geschlecht
title: Interne vs. externe qualifizierte Bewerbungen
filter: Qualifizierte Bewerbungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele qualifizierte Bewerbungen je Organisationseinheit?
> Datenquelle: Bewerbungsmanagement-Software · Personenkreis: Qualifizierte Bewerbungen · Datensatz: Zeitraum_Bewerbung

```chart
data: Zeitraum_Bewerbung
type: distance
x: Organisationseinheit
y: Organisationseinheit
color: Geschlecht
title: Bewerbungen je Organisationseinheit
filter: Qualifizierte Bewerbungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen werden in den Entgelt-/Besoldungsgruppen eingestellt?
> Datenquelle: PVS · Personenkreis: Einstellungen · Datensatz: Zeitraum_Einstellung

```chart
data: Zeitraum_Einstellung
type: bar
x: Entgeltgruppe / Besoldungsgruppe
y: Entgeltgruppe / Besoldungsgruppe
color: Geschlecht
title: Neueinstellungen nach Entgelt-/Besoldungsgruppe
filter: Einstellungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen werden in den QEs eingestellt?
> Datenquelle: PVS · Personenkreis: Einstellungen · Datensatz: Zeitraum_Einstellung

```chart
data: Zeitraum_Einstellung
type: bar
x: QE
y: QE
color: Geschlecht
title: Neueinstellungen nach Qualifikationsebene
filter: Einstellungen
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Führung

::: {.callout-note title='Definitionen'}
**Führungskraft (aktiv):** Person, die aktuell eine Führungsfunktion mit Personalverantwortung wahrnimmt.

**Führungsebene:** Hierarchische Einordnung der Führungsfunktion (1 = höchste Ebene).

**Führung in Tandem:** Geteilte Führungsverantwortung, häufig in Verbindung mit Teilzeit oder Job-Sharing.
:::

#### Wie viele Männer und Frauen sind in leitenden Funktionen?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: Führungskraft (aktiv)
color: Geschlecht
title: Beschäftigte in leitenden Funktionen
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen sind in den Führungsebenen?
> Datenquelle: PVS · Personenkreis: Führungskräfte · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: Führungsebene
color: Geschlecht
title: Führungsebenen nach Geschlecht
filter: Führungskraft (aktiv)
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Führungskräfte in den Organisationseinheiten?
> Datenquelle: PVS · Personenkreis: Führungskräfte · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Organisationseinheit
y: Organisationseinheit
color: Geschlecht
title: Führungskräfte in den Organisationseinheiten
filter: Führungskraft (aktiv)
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Führungskräfte arbeiten in Tandem je QE?
> Datenquelle: PVS · Personenkreis: Führungskräfte · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: QE
value: Führung in Tandem
color: Geschlecht
title: Anteil Führung in Tandem (in der Gruppe) je QE
filter: Führungskraft (aktiv)
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Wie viele Führungskräfte arbeiten in Tandem je Führungsebene?
> Datenquelle: PVS · Personenkreis: Führungskräfte · Datensatz: Stichtag

```chart
data: Stichtag
type: pyramid
y: Führungsebene
value: Führung in Tandem
color: Geschlecht
title: Anteil Führung in Tandem je Führungsebene
filter: Führungskraft (aktiv)
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen führen in Teilzeit?
> Datenquelle: PVS · Personenkreis: Führungskräfte · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
x: Teilzeit / Vollzeit
y: Teilzeit / Vollzeit
color: Geschlecht
title: Führung in Teilzeit
filter: Führungskraft (aktiv)
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Teilzeit

::: {.callout-note title='Definitionen'}
**Teilzeit / Vollzeit:** Klassifikation der Arbeitszeit nach Anteil der vereinbarten Wochenarbeitszeit.

**Arbeitszeitanteil:** Prozentualer Anteil an der Vollzeitstelle.
:::

#### Wie viele Männer und Frauen arbeiten in Teil- bzw. Vollzeit?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
x: Teilzeit / Vollzeit
y: Teilzeit / Vollzeit
color: Geschlecht
title: Teilzeit vs. Vollzeit
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Männer und Frauen in welchen Arbeitszeitanteilen?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
stacked: true
x: Arbeitszeitanteil
y: Arbeitszeitanteil
color: Geschlecht
title: Arbeitszeitanteile nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Beurlaubung

::: {.callout-note title='Definitionen'}
**Elternzeit:** Beurlaubung nach Bundeselterngeld- und Elternzeitgesetz.

**Familienpolitische Beurlaubung:** Beurlaubung aus familiären Gründen über Elternzeit hinaus.

**Dauer der Elternzeit (Tage):** Kalendertage zwischen Antritts- und Endedatum der Elternzeit.
:::

#### Wie viele Männer und Frauen sind aus familiären Gründen beurlaubt?
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
stacked: true
x: Beurlaubung
y: Beurlaubung
color: Geschlecht
title: Beurlaubungen aus familiären Gründen
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie lange sind Männer und Frauen in Elternzeit?
> Datenquelle: PVS · Personenkreis: Personen in Elternzeit · Datensatz: Zeitraum_Beurlaubung

```chart
data: Zeitraum_Beurlaubung
type: pyramid
y: QE
value: Dauer der Elternzeit (Tage)
color: Geschlecht
title: Durchschnittliche Dauer der Elternzeit (Tage) je QE
filter: Personen in Elternzeit
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Wie viele Personen in Elternzeit je Entgelt-/Besoldungsgruppe?
> Datenquelle: PVS · Personenkreis: Personen in Elternzeit · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Entgeltgruppe / Besoldungsgruppe
y: Entgeltgruppe / Besoldungsgruppe
color: Geschlecht
title: In Elternzeit nach Entgeltgruppe
filter: Personen in Elternzeit
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Beurteilungen

::: {.callout-note title='Definitionen'}
**Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung:** Punktewert der zuletzt abgeschlossenen periodischen Beurteilung (0–16, dienststellenspezifisch).

**Beamte vs. Tarifbeschäftigte:** Statusrechtliche Unterscheidung — separate Auswertung wegen unterschiedlicher Beurteilungssysteme.
:::

#### Beurteilung verbeamteter Personen nach QE
> Datenquelle: PVS · Personenkreis: Beamte · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: QE
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Durchschnittliche Beurteilung Beamte nach QE
filter: Beamte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Beurteilung verbeamteter Personen — Teilzeit vs. Vollzeit
> Datenquelle: PVS · Personenkreis: Beamte · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
x: Teilzeit / Vollzeit
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Beurteilung Beamte — Teilzeit vs. Vollzeit
filter: Beamte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Beurteilung verbeamteter Personen je Organisationseinheit
> Datenquelle: PVS · Personenkreis: Beamte · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Organisationseinheit
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Beurteilung Beamte je Organisationseinheit
filter: Beamte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Beurteilung Tarifbeschäftigter nach QE
> Datenquelle: PVS · Personenkreis: Tarifbeschäftigte · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: QE
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Durchschnittliche Beurteilung Tarifbeschäftigte nach QE
filter: Tarifbeschäftigte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Beurteilung Tarifbeschäftigter — Teilzeit vs. Vollzeit
> Datenquelle: PVS · Personenkreis: Tarifbeschäftigte · Datensatz: Stichtag

```chart
data: Stichtag
type: bar
x: Teilzeit / Vollzeit
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Beurteilung Tarifbeschäftigte — Teilzeit vs. Vollzeit
filter: Tarifbeschäftigte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Beurteilung Tarifbeschäftigter je Organisationseinheit
> Datenquelle: PVS · Personenkreis: Tarifbeschäftigte · Datensatz: Stichtag

```chart
data: Stichtag
type: distance
x: Organisationseinheit
y: Aktuellestes vorliegendes Ergebnis periodischer dienstlicher Beurteilung
color: Geschlecht
title: Beurteilung Tarifbeschäftigte je Organisationseinheit
filter: Tarifbeschäftigte
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Beförderungen und Höhergruppierungen

::: {.callout-note title='Definitionen'}
**Beförderung:** Verleihung eines höheren statusrechtlichen Amtes (Beamte).

**Höhergruppierung:** Eingruppierung in eine höhere Entgeltgruppe (Tarifbeschäftigte).

**Maßnahmenantrag:** Beantragung der Höhergruppierung durch die beschäftigte Person bzw. Stelle.
:::

#### Beförderungen je QE — Beamte
> Datenquelle: PVS · Personenkreis: Beamte · Datensatz: Zeitraum_Befoerderung

```chart
data: Zeitraum_Befoerderung
type: bar
x: QE
y: Beförderung (ja/nein)
color: Geschlecht
title: Anteil Beförderungen je QE — Beamte
filter: Beamte
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Beförderungen je Besoldungsgruppe — Beamte
> Datenquelle: PVS · Personenkreis: Beamte · Datensatz: Zeitraum_Befoerderung

```chart
data: Zeitraum_Befoerderung
type: bar
x: Entgeltgruppe / Besoldungsgruppe
y: Beförderung (ja/nein)
color: Geschlecht
title: Anteil Beförderungen je Besoldungsgruppe — Beamte
filter: Beamte
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Höhergruppierungen nach Maßnahmenart
> Datenquelle: PVS · Personenkreis: Tarifbeschäftigte · Datensatz: Zeitraum_Befoerderung

```chart
data: Zeitraum_Befoerderung
type: bar
x: Maßnahmenart
y: Maßnahmenart
color: Geschlecht
title: Höhergruppierungen nach Maßnahmenart
filter: Tarifbeschäftigte
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Höhergruppierungen auf Antrag
> Datenquelle: PVS · Personenkreis: Höhergruppierung genehmigt · Datensatz: Zeitraum_Befoerderung

```chart
data: Zeitraum_Befoerderung
type: bar
x: Maßnahmenantrag
y: Maßnahmenantrag
color: Geschlecht
title: Höhergruppierungen — auf Antrag vs. dienstseitig
filter: Höhergruppierung genehmigt
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Qualifizierung

::: {.callout-note title='Definitionen'}
**Qualifikationsart:** Modulare Qualifizierung (MQ), Ausbildungsqualifizierung (AQ), Beförderung in höhere Laufbahn (BL) u. a.

**Bewilligt vs. abgeschlossen:** Eine bewilligte Maßnahme kann noch offen sein; abgeschlossen heißt erfolgreich beendet.
:::

#### Anteil abgeschlossener Qualifizierungen je Qualifikationsart
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Zeitraum_Qualifikation

```chart
data: Zeitraum_Qualifikation
type: distance
x: Qualifikationsart
y: Qualifizierungsmaßnahme abgeschlossen (ja / nein)
color: Geschlecht
title: Anteil abgeschlossener Qualifizierungen je Art
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Anteil bewilligter Qualifizierungen je Qualifikationsart
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Zeitraum_Qualifikation

```chart
data: Zeitraum_Qualifikation
type: distance
x: Qualifikationsart
y: Qualifizierungsmaßnahme bewilligt (ja / nein)
color: Geschlecht
title: Anteil bewilligter Qualifizierungen je Art
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Fortbildungen

::: {.callout-note title='Definitionen'}
**Fortbildung:** Anlassbezogene Weiterbildungsmaßnahmen, nicht zwingend mit Abschluss.
:::

#### Anteil Fortbildungsteilnahme — Teilzeit vs. Vollzeit
> Datenquelle: unklar · Personenkreis: Alle · Datensatz: Zeitraum_Fortbildung

```chart
data: Zeitraum_Fortbildung
type: bar
x: Arbeitszeitmodell
y: Teilnahme an Fortbildung (ja / nein)
color: Geschlecht
title: Anteil Fortbildungsteilnahme — Teilzeit vs. Vollzeit
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Leistungskomponenten

::: {.callout-note title='Definitionen'}
**Leistungskomponente (LK):** Sammelbegriff für Leistungsprämien, Leistungsentgelte und leistungsorientierte Bezahlung (LOB).

**Höhe Leistungskomponente:** Auszahlungsbetrag im Berichtszeitraum.
:::

#### Durchschnittliche Leistungskomponente je Entgeltgruppe
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Zeitraum_Leistungskomponente

```chart
data: Zeitraum_Leistungskomponente
type: distance
x: Entgeltgruppe / Besoldungsgruppe
y: Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
color: Geschlecht
title: Ø Leistungskomponente je Entgeltgruppe
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Durchschnittliche Leistungskomponente je QE
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Zeitraum_Leistungskomponente

```chart
data: Zeitraum_Leistungskomponente
type: pyramid
y: QE
value: Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
color: Geschlecht
title: Ø Leistungskomponente je QE
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Durchschnittliche Leistungskomponente — Teilzeit vs. Vollzeit
> Datenquelle: PVS · Personenkreis: Alle · Datensatz: Zeitraum_Leistungskomponente

```chart
data: Zeitraum_Leistungskomponente
type: bar
x: Arbeitszeitmodell
y: Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
color: Geschlecht
title: Ø Leistungskomponente — Teilzeit vs. Vollzeit
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Aggregierte Tabelle: Leistungskomponenten je Entgeltgruppe
> Tabelle mit Anzahl Auszahlungen und Mittelwert der Leistungskomponente je Entgeltgruppe.

```table
data: Zeitraum_Leistungskomponente
columns:
  - Entgeltgruppe / Besoldungsgruppe
  - PersNr
  - Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)
caption: Leistungskomponenten je Entgeltgruppe — Anzahl Auszahlungen und Mittelwert
aggregation:
  Entgeltgruppe / Besoldungsgruppe: identity
  PersNr: count
  Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB): mean
format:
  Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB): decimal
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

## Ziele / Zielvorgaben

_Hier werden die konkreten Ziele formuliert, die aus der Situationsbeschreibung abgeleitet wurden._

## Zwischenbilanz und Überprüfung der letzten Ziele

_Rückblick auf das vorangegangene Konzept, Stand der Maßnahmenumsetzung._

## Maßnahmen

_Konkrete Maßnahmen zur Umsetzung der Ziele._

## Kostenmäßige Auswirkungen

_Schätzung von Personal-, Sachkosten und ggf. erforderlichen Stellenanteilen._

## Inkrafttreten

_Datum des Inkrafttretens, Geltungsdauer, Berichtspflichten._
