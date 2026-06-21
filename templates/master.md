# {{title}}

**{{office}}**

## Einleitung

Der Schuljahresbericht fasst die wesentlichen Kennzahlen des abgelaufenen Schuljahres zusammen und macht die Entwicklung der Schule für Schulgemeinschaft, Sachaufwandsträger und Schulaufsicht nachvollziehbar. Er stützt sich auf die Daten des Schulverwaltungsprogramms (Stichtag der amtlichen Schulstatistik) sowie auf die im Schuljahr erfassten Ereignisse (Anmeldungen, Förderungen, Wettbewerbe u. a.).

Grundlage der schulischen Selbstverwaltung ist das Bayerische Gesetz über das Erziehungs- und Unterrichtswesen (BayEUG). Das Schulforum und die Lehrerkonferenz beraten auf Basis dieser Auswertung über Schwerpunkte und Maßnahmen für das kommende Schuljahr.

## Situationsbeschreibung

### Gesamtübersicht

::: {.callout-note title='Definitionen'}
**Geschlecht:** Im Datensatz wird zwischen den Ausprägungen unterschieden, die das Schulverwaltungssystem führt.

**Jahrgangsstufe:** Jahrgangsstufe der Schülerin/des Schülers (5–12 am bayerischen Gymnasium).

**Ausbildungsrichtung:** Profil des Gymnasiums, z. B. Naturwissenschaftlich-technologisch, Sprachlich, Musisch, Wirtschaftswissenschaftlich.

**Migrationshintergrund:** Liegt nach Definition der amtlichen Schulstatistik ein Migrationshintergrund vor.
:::

#### Wie viele Schülerinnen und Schüler besuchen unsere Schule?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: pie
y: Geschlecht
color: Geschlecht
title: Geschlechterverteilung der Schülerschaft
filter: Alle
aggregation:
  y: share_total
```

_Hier ist Platz für Freitext._

#### Wie verteilen sich die Schülerinnen und Schüler auf die Jahrgangsstufen?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: distance
x: Jahrgangsstufe
y: Jahrgangsstufe
color: Geschlecht
title: Schülerinnen und Schüler je Jahrgangsstufe
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie verteilen sich die Schülerinnen und Schüler auf die Ausbildungsrichtungen?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
stacked: true
x: Ausbildungsrichtung
y: Ausbildungsrichtung
color: Geschlecht
title: Schülerschaft nach Ausbildungsrichtung
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Schülerinnen und Schüler haben einen Migrationshintergrund?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
stacked: true
x: Migrationshintergrund
y: Migrationshintergrund
color: Geschlecht
title: Migrationshintergrund nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie ist das Geschlechterverhältnis in den Jahrgangsstufen?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: pyramid
y: Jahrgangsstufe
color: Geschlecht
title: Jahrgangsstufen nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Welche erste Fremdsprache wählen die Schülerinnen und Schüler?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
x: Erste Fremdsprache
y: Erste Fremdsprache
color: Geschlecht
title: Erste Fremdsprache nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Übersicht: Anzahl und Anteil je Jahrgangsstufe (Tabelle)
> Aggregierte Tabelle mit Schülerzahl und Anteil an der Gesamtschülerschaft je Jahrgangsstufe. Werte unter dem Datenschutzschwellwert erscheinen als `<5`.

```table
data: Schueler
columns:
  - Jahrgangsstufe
  - SchuelerID
  - Geschlecht
caption: Schülerinnen und Schüler je Jahrgangsstufe — Anzahl und Anteil an der Gesamtschülerschaft
aggregation:
  Jahrgangsstufe: identity
  SchuelerID: count
  Geschlecht: share_total
format:
  Geschlecht: decimal
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Anmeldungen und Eintritte

::: {.callout-note title='Definitionen'}
**Aufnahmeempfehlung:** Eignungsempfehlung der abgebenden Schule bzw. geeignetes Übertrittszeugnis.

**Eintritt:** Neuaufnahme an unserer Schule im Berichtszeitraum.

**Sprengel / Gastschüler:** Anmeldung aus dem eigenen Schulsprengel bzw. von außerhalb (Gastschüler).
:::

#### Wie viele Anmeldungen mit Aufnahmeempfehlung gehen je Ausbildungsrichtung ein?
> Datenquelle: Anmeldeverwaltung · Personenkreis: Mit Aufnahmeempfehlung · Datensatz: Zeitraum_Anmeldung

```chart
data: Zeitraum_Anmeldung
type: pyramid
y: Gewünschte Ausbildungsrichtung
color: Geschlecht
title: Anmeldungen mit Aufnahmeempfehlung nach gewünschter Ausbildungsrichtung
filter: Aufnahmeempfehlung
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Aus welchen Schularten kommen die Anmeldungen?
> Datenquelle: Anmeldeverwaltung · Personenkreis: Mit Aufnahmeempfehlung · Datensatz: Zeitraum_Anmeldung

```chart
data: Zeitraum_Anmeldung
type: pyramid
y: Herkunftsschulart
color: Geschlecht
title: Anmeldungen nach Herkunftsschulart
filter: Aufnahmeempfehlung
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Anmeldungen kommen aus dem Sprengel bzw. von Gastschülern?
> Datenquelle: Anmeldeverwaltung · Personenkreis: Mit Aufnahmeempfehlung · Datensatz: Zeitraum_Anmeldung

```chart
data: Zeitraum_Anmeldung
type: pyramid
y: Sprengelzugehörigkeit
color: Geschlecht
title: Sprengel- vs. Gastschüleranmeldungen
filter: Aufnahmeempfehlung
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Eintritte je Ausbildungsrichtung?
> Datenquelle: Schulverwaltung · Personenkreis: Eintritte · Datensatz: Zeitraum_Eintritt

```chart
data: Zeitraum_Eintritt
type: bar
x: Ausbildungsrichtung
y: Ausbildungsrichtung
color: Geschlecht
title: Neueintritte nach Ausbildungsrichtung
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Eintritte je Jahrgangsstufe?
> Datenquelle: Schulverwaltung · Personenkreis: Eintritte · Datensatz: Zeitraum_Eintritt

```chart
data: Zeitraum_Eintritt
type: bar
x: Jahrgangsstufe
y: Jahrgangsstufe
color: Geschlecht
title: Neueintritte nach Jahrgangsstufe
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Förderung und Inklusion

::: {.callout-note title='Definitionen'}
**Förderart:** Art der Fördermaßnahme (z. B. LRS-Förderung, Sprachförderung, Begabtenförderung, Förderkurs).

**Inklusion:** Festgestellter sonderpädagogischer Förderbedarf bzw. inklusive Beschulung.

**Ganztagsbetreuung:** Teilnahme an der offenen oder gebundenen Ganztagsbetreuung.
:::

#### Wie viele Fördermaßnahmen je Förderart?
> Datenquelle: Förderkoordination · Personenkreis: Alle · Datensatz: Zeitraum_Foerdermassnahme

```chart
data: Zeitraum_Foerdermassnahme
type: pyramid
y: Förderart
color: Geschlecht
title: Fördermaßnahmen nach Förderart
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie verteilen sich die Fördermaßnahmen auf die Jahrgangsstufen?
> Datenquelle: Förderkoordination · Personenkreis: Alle · Datensatz: Zeitraum_Foerdermassnahme

```chart
data: Zeitraum_Foerdermassnahme
type: distance
x: Jahrgangsstufe
y: Jahrgangsstufe
color: Geschlecht
title: Fördermaßnahmen je Jahrgangsstufe
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Anteil erfolgreich abgeschlossener Fördermaßnahmen je Förderart
> Datenquelle: Förderkoordination · Personenkreis: Alle · Datensatz: Zeitraum_Foerdermassnahme

```chart
data: Zeitraum_Foerdermassnahme
type: distance
x: Förderart
y: Fördermaßnahme abgeschlossen (ja/nein)
color: Geschlecht
title: Anteil abgeschlossener Fördermaßnahmen je Art
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Wie viele Schülerinnen und Schüler werden inklusiv beschult?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
stacked: true
x: Inklusion
y: Inklusion
color: Geschlecht
title: Inklusive Beschulung nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie viele Schülerinnen und Schüler nutzen die Ganztagsbetreuung?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
x: Ganztagsbetreuung
y: Ganztagsbetreuung
color: Geschlecht
title: Ganztagsbetreuung nach Geschlecht
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Beurlaubungen

::: {.callout-note title='Definitionen'}
**Beurlaubung:** Befreiung vom Unterricht aus einem anerkannten Grund (z. B. familiäre Anlässe, gesundheitliche Kur).

**Beurlaubungsgrund:** Anerkannter Grund der Beurlaubung.

**Dauer der Beurlaubung (Tage):** Kalendertage zwischen Beginn und Ende der Beurlaubung.
:::

#### Aus welchen Gründen werden Schülerinnen und Schüler beurlaubt?
> Datenquelle: Sekretariat · Personenkreis: Alle · Datensatz: Zeitraum_Beurlaubung

```chart
data: Zeitraum_Beurlaubung
type: bar
stacked: true
x: Beurlaubungsgrund
y: Beurlaubungsgrund
color: Geschlecht
title: Beurlaubungen nach Grund
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wie lange dauern Beurlaubungen je Jahrgangsstufe?
> Datenquelle: Sekretariat · Personenkreis: Beurlaubte · Datensatz: Zeitraum_Beurlaubung

```chart
data: Zeitraum_Beurlaubung
type: pyramid
y: Jahrgangsstufe
value: Dauer der Beurlaubung (Tage)
color: Geschlecht
title: Durchschnittliche Dauer der Beurlaubung (Tage) je Jahrgangsstufe
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Wie viele Beurlaubungen je Ausbildungsrichtung?
> Datenquelle: Sekretariat · Personenkreis: Beurlaubte · Datensatz: Zeitraum_Beurlaubung

```chart
data: Zeitraum_Beurlaubung
type: distance
x: Ausbildungsrichtung
y: Ausbildungsrichtung
color: Geschlecht
title: Beurlaubungen je Ausbildungsrichtung
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Leistungen und Noten

::: {.callout-note title='Definitionen'}
**Notendurchschnitt:** Zeugnisnotendurchschnitt im Berichtszeitraum (1,0 = sehr gut … 6,0 = ungenügend).

**Oberstufe:** Zugehörigkeit zur gymnasialen Oberstufe (ab Jahrgangsstufe 11), abgeleitet aus der Jahrgangsstufe.
:::

#### Wie ist der Notendurchschnitt je Jahrgangsstufe?
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: distance
x: Jahrgangsstufe
y: Notendurchschnitt
color: Geschlecht
title: Durchschnittlicher Notendurchschnitt je Jahrgangsstufe
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Notendurchschnitt — mit vs. ohne Ganztagsbetreuung
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: bar
x: Ganztagsbetreuung
y: Notendurchschnitt
color: Geschlecht
title: Notendurchschnitt — Ganztag vs. Halbtag
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Notendurchschnitt je Ausbildungsrichtung
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Schueler

```chart
data: Schueler
type: distance
x: Ausbildungsrichtung
y: Notendurchschnitt
color: Geschlecht
title: Durchschnittlicher Notendurchschnitt je Ausbildungsrichtung
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Notendurchschnitt in der Oberstufe je Jahrgangsstufe
> Datenquelle: Schulverwaltung · Personenkreis: Oberstufe · Datensatz: Schueler

```chart
data: Schueler
type: distance
x: Jahrgangsstufe
y: Notendurchschnitt
color: Geschlecht
title: Notendurchschnitt der Oberstufe je Jahrgangsstufe
filter: Oberstufe
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Vorrückung und Wiederholung

::: {.callout-note title='Definitionen'}
**Vorrückung:** Regulärer Aufstieg in die nächste Jahrgangsstufe.

**Wiederholung:** Erneutes Durchlaufen der Jahrgangsstufe (freiwillig oder angeordnet).

**Antrag:** Erfolgte die Entscheidung auf Antrag der Eltern oder regulär durch die Klassenkonferenz.
:::

#### Anteil Vorrückungen je Jahrgangsstufe
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Zeitraum_Vorrueckung

```chart
data: Zeitraum_Vorrueckung
type: bar
x: Jahrgangsstufe
y: Vorgerückt (ja/nein)
color: Geschlecht
title: Anteil Vorrückungen je Jahrgangsstufe
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Anteil Wiederholungen je Jahrgangsstufe
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Zeitraum_Vorrueckung

```chart
data: Zeitraum_Vorrueckung
type: bar
x: Jahrgangsstufe
y: Wiederholung (ja/nein)
color: Geschlecht
title: Anteil Wiederholungen je Jahrgangsstufe
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Ergebnisse der Jahrgangsstufenentscheidung nach Ausbildungsrichtung
> Datenquelle: Schulverwaltung · Personenkreis: Alle · Datensatz: Zeitraum_Vorrueckung

```chart
data: Zeitraum_Vorrueckung
type: bar
x: Ergebnis
y: Ergebnis
color: Geschlecht
title: Ergebnisse der Jahrgangsstufenentscheidung
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

#### Wiederholungen auf Antrag vs. regulär
> Datenquelle: Schulverwaltung · Personenkreis: Wiederholungen · Datensatz: Zeitraum_Vorrueckung

```chart
data: Zeitraum_Vorrueckung
type: bar
x: Antrag
y: Antrag
color: Geschlecht
title: Wiederholungen — auf Antrag vs. regulär
filter: Wiederholung (ja/nein)
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Wettbewerbe und Arbeitsgemeinschaften

::: {.callout-note title='Definitionen'}
**Wettbewerbsart:** Fachliche Ausrichtung des Wettbewerbs (z. B. MINT, Sprachen, Musik, Sport).

**Erfolgreiche Teilnahme:** Teilnahme, die mit einer Platzierung bzw. Urkunde abgeschlossen wurde.
:::

#### Anteil erfolgreicher Teilnahmen — mit vs. ohne Ganztagsbetreuung
> Datenquelle: Fachschaften · Personenkreis: Alle · Datensatz: Zeitraum_Wettbewerb

```chart
data: Zeitraum_Wettbewerb
type: bar
x: Ganztagsbetreuung
y: Erfolgreiche Teilnahme (ja/nein)
color: Geschlecht
title: Anteil erfolgreicher Teilnahmen — Ganztag vs. Halbtag
filter: Alle
aggregation:
  y: share_group
```

_Hier ist Platz für Freitext._

#### Wie viele Teilnahmen je Wettbewerbsart?
> Datenquelle: Fachschaften · Personenkreis: Alle · Datensatz: Zeitraum_Wettbewerb

```chart
data: Zeitraum_Wettbewerb
type: distance
x: Wettbewerbsart
y: Wettbewerbsart
color: Geschlecht
title: Wettbewerbsteilnahmen nach Art
filter: Alle
aggregation:
  y: count
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

### Auszeichnungen und Preise

::: {.callout-note title='Definitionen'}
**Auszeichnungsart:** Art der Auszeichnung (z. B. Wettbewerbspreis, Sozialpreis, Sportabzeichen).

**Punkte:** Erreichte Wertungspunkte bzw. Höhe der Auszeichnung im Berichtszeitraum.
:::

#### Durchschnittliche Punktzahl je Ausbildungsrichtung
> Datenquelle: Fachschaften · Personenkreis: Alle · Datensatz: Zeitraum_Auszeichnung

```chart
data: Zeitraum_Auszeichnung
type: distance
x: Ausbildungsrichtung
y: Punkte
color: Geschlecht
title: Ø Punkte je Ausbildungsrichtung
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Durchschnittliche Punktzahl je Jahrgangsstufe
> Datenquelle: Fachschaften · Personenkreis: Alle · Datensatz: Zeitraum_Auszeichnung

```chart
data: Zeitraum_Auszeichnung
type: pyramid
y: Jahrgangsstufe
value: Punkte
color: Geschlecht
title: Ø Punkte je Jahrgangsstufe
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Durchschnittliche Punktzahl — mit vs. ohne Ganztagsbetreuung
> Datenquelle: Fachschaften · Personenkreis: Alle · Datensatz: Zeitraum_Auszeichnung

```chart
data: Zeitraum_Auszeichnung
type: bar
x: Ganztagsbetreuung
y: Punkte
color: Geschlecht
title: Ø Punkte — Ganztag vs. Halbtag
filter: Alle
aggregation:
  y: mean
```

_Hier ist Platz für Freitext._

#### Aggregierte Tabelle: Auszeichnungen je Art
> Tabelle mit Anzahl der Auszeichnungen und Mittelwert der Punkte je Auszeichnungsart.

```table
data: Zeitraum_Auszeichnung
columns:
  - Auszeichnungsart
  - SchuelerID
  - Punkte
caption: Auszeichnungen je Art — Anzahl und durchschnittliche Punktzahl
aggregation:
  Auszeichnungsart: identity
  SchuelerID: count
  Punkte: mean
format:
  Punkte: decimal
```

_Hier ist Platz für Freitext._

::: {.callout-tip title='Fazit'}
_Hier ist Platz für ein Kapitelfazit._
:::

## Ziele und Schwerpunkte

_Hier werden die konkreten Ziele und Schwerpunkte formuliert, die aus der Situationsbeschreibung abgeleitet wurden._

## Rückblick auf das vergangene Schuljahr

_Stand der Umsetzung der zuletzt gesetzten Ziele und Maßnahmen._

## Maßnahmen

_Konkrete Maßnahmen zur Umsetzung der Ziele im kommenden Schuljahr._

## Ressourcen und Ausstattung

_Personelle und sächliche Ausstattung, Bedarf an Räumen, Stellen und Sachmitteln._

## Schlussbemerkung

_Datum, Beschluss des Schulforums, Geltungsdauer._
