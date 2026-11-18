<img src="img/ondatix_Logo_V1_dunkler_Hintergrund_SVG.svg" alt="ondatix Logo" class="logo" height="80" align="right"/><br><br>

# reportix — `config.yaml` Handbuch · handbook

`config.yaml` is the entry point that configures the app — a thin **manifest** listing the per-section files under `config/` (`parameters.yaml`, `data.yaml` — which also carries the `data_parameters:` and `preprocessing:` sections — `template.yaml`, `export.yaml`, `charts.yaml`), which are merged at build time. This handbook is **bilingual**: an English and a German version of the same reference.

`config.yaml` ist der Einstiegspunkt zur Konfiguration der App — ein schlankes **Manifest**, das die Abschnittsdateien unter `config/` auflistet (`parameters.yaml`, `data.yaml` — enthält auch die Abschnitte `data_parameters:` und `preprocessing:` —, `template.yaml`, `export.yaml`, `charts.yaml`), die zur Build-Zeit zusammengeführt werden. Dieses Handbuch ist **zweisprachig**: eine englische und eine deutsche Fassung derselben Referenz.

**🌐 Language / Sprache:** **[Deutsch ↓](#-deutsch)** · **[English ↓](#-english)**

> **Keep both versions in sync.** Whenever `config.yaml` or the config schema changes, update **both** the English and the German sections below in the same commit.
>
> **Beide Fassungen synchron halten.** Wird `config.yaml` oder das Konfigurationsschema geändert, müssen **beide** Abschnitte (Englisch und Deutsch) im selben Commit aktualisiert werden.

---

<a id="-deutsch"></a>

# 🇩🇪 Deutsch

<sub>[Zur englischen Fassung ↑](#-english)</sub>

`config.yaml` legt fest, **was die App den Nutzer fragt, wo die Daten liegen, welche Vorlagen ausgeliefert werden und wie die Ausgabe gestaltet wird**. Die Konfiguration liegt im Projektstamm: `config.yaml` ist ein schlankes Manifest mit der `include:`-Liste der Abschnittsdateien unter `config/`. Jede Abschnittsdatei enthält eine oberste Ebene (`parameters:`, `data:` usw.) — `data.yaml` führt zusätzlich den eng verwandten Abschnitt `preprocessing:`; das Config-Modul lädt sie zur Build-Zeit über Vites `import.meta.glob('/config/*.yaml', { query: '?raw' })`, parst sie und führt sie flach zusammen (die obersten Ebenen sind disjunkt, die Reihenfolge dokumentiert nur die Absicht). Die Dateien werden **nicht von Endnutzern hochgeladen** — nur Entwickler bearbeiten sie.

Dieser Abschnitt ist die maßgebliche Referenz für jeden Schlüssel. Jeder Unterabschnitt beginnt mit einem minimalen YAML-Beispiel und führt anschließend jedes Feld auf.

## Inhalt (Deutsch)

- [Aufbau der obersten Ebene](#de-top-level-layout)
- [`parameters:`](#de-parameters)
  - [Lokalisierte Beschriftungen (`label:`)](#de-localized-labels)
  - [Eigenständige vs. gebundene Parameter](#de-standalone-vs-bound)
  - [Parametertypen](#de-parameter-types)
  - [Besondere Parameterschlüssel (`palette`, `font`, `page_orientation`, `page_numbers`)](#de-special-keys)
- [`data:`](#de-data)
- [`preprocessing:`](#de-preprocessing)
- [`template:`](#de-template)
  - [Fragenkatalog (`template.questions`)](#de-template-questions)
- [`data_parameters:`](#de-data-protection)
- [`export:`](#de-export)
- [`charts:`](#de-charts)
- [Rezepte](#de-recipes)
- [Querverweise](#de-cross-references)

---

<a id="de-top-level-layout"></a>

## Aufbau der obersten Ebene

```yaml
parameters:        # Formularfelder vor der Berichtserstellung
data:              # erwartete Tabellenblätter/Spalten in hochgeladenen .xlsx-Dateien
preprocessing:     # abgeleitete Datensätze (Joins) vor dem Rendering
template:          # gebündelte Markdown-Vorlagen zur Auswahl
data_parameters:   # Berichtszeitraum + Maskierungsschwelle für aggregierte Zählwerte
export:            # DOCX-Gestaltung und Metadaten
charts:            # globale Standardwerte für die Diagrammdarstellung
```

Alle Abschnitte sind optional außer `parameters:`, `data:` und `template:`; in der Praxis benötigt man für jeden nicht-trivialen Bericht jedoch auch `export:` und `charts:`.

---

<a id="de-parameters"></a>

## `parameters:`

Der Abschnitt `parameters` steuert das in Schritt 4 („Berichtsparameter") dargestellte Formular. Jeder Eintrag ist ein Formularfeld.

```yaml
parameters:
  title:
    label: "Titel"            # einfacher String — in jeder Sprache gleich
    type: text
    default: "Bericht"
  office:
    label:                    # oder eine Sprachzuordnung (siehe unten)
      de: "Schule"
      en: "School"
    type: text
    default: "Ministerium"
  font_size:
    label: "Schriftgröße des Texts (pt)"
    type: number
    bind: export.font.size
```

Jeder Parameter kann zusätzlich `definition:` (nur Deutsch) oder `info:` (zweisprachig) tragen — der Text erscheint als anklickbarer ⓘ-Tooltip neben der Beschriftung (siehe [Tooltips](#de-tooltips)).

**In welchem Schritt gefragt wird — `step:`.** Standardmäßig erscheint jeder Parameter in Schritt 4 („Berichtsparameter"), zusammen mit den Layout-Einstellungen. `step: template` stellt das Feld stattdessen in **Schritt 1** neben die Vorlagenauswahl — gedacht für Angaben, die den Bericht selbst beschreiben und sinnvollerweise zuerst beantwortet werden, wie der Berichtszeitraum:

```yaml
  period_start:
    label:
      de: "Berichtszeitraum von"
      en: "Reporting period from"
    type: date
    step: template            # Schritt 1 statt Schritt 4
    bind: dataParameters.periodStart
```

| Wert | Wirkung |
|---|---|
| `parameters` (Standard) | Schritt 4, „Berichtsparameter" |
| `template` | Schritt 1, „Zeitraum und Vorlage wählen" |
| `data` | Schritt 3, „Datenvalidierung" — Checkliste aus den hochgeladenen Werten (siehe unten) |

Schritt 1 rendert diese Felder als eigene Zeile (`buildInlineFields`), nicht über das Parameterformular aus Schritt 4: Jenes endet mit der Schaltfläche „Bericht erstellen", die in Schritt 1 die falsche Aktion wäre — dort geht es mit „Weiter" weiter — und stapelt seine Felder untereinander, während ein Von/Bis-Paar nebeneinander gehört. Beschriftungen und ⓘ-Tooltips funktionieren identisch. Die Werte aus Schritt 1 und 3 werden beim Erzeugen der Vorschau mit denen aus Schritt 4 zusammengeführt.

**Checklisten aus den Daten — `step: data`, `options_from`, `default_when`.** Manche Entscheidungen hängen davon ab, welche Werte in der hochgeladenen Datei tatsächlich vorkommen — etwa welche Ausbildungsrichtungen als MINT-Zweig zählen. Ein `multiselect` mit `step: data` erscheint deshalb im Schritt **3 „Datenvalidierung"** als Checkliste: `options_from` nennt Datensatz und Spalte, angeboten werden deren unterschiedliche nicht-leere Werte (mit Zeilenzahl, natürlich sortiert: `Q9` vor `Q10`). Vorausgewählt ist jeder Wert, auf den `default_when` zutrifft — dieselben Operatoren wie bei `when:` einer Mutation. Die Auswahl steht **vor** dem Preprocessing fest; eine Mutation liest sie über `from_config` (siehe [`mutations`](#de-preprocessing)). Jede Änderung einer Checkliste berechnet Preprocessing und Warnungen sofort neu.

```yaml
  mint_profiles:
    label: { de: "Ausbildungsrichtungen des MINT-Zweigs", en: "Profiles counting as STEM" }
    type: multiselect
    step: data
    options_from: { dataset: Schueler, column: Ausbildungsrichtung }
    default_when: { contains: [Naturwissenschaft, Technik, technolog] }
    bind: dataParameters.selections.mint_profiles
```

| Feld | Typ | Anmerkungen |
|---|---|---|
| `options_from` | `{ dataset, column }` | Quelle der Optionen, gelesen aus den **hochgeladenen** Daten vor dem Preprocessing. Fehlt der Datensatz oder hat die Spalte keine Werte, entfällt die Checkliste. |
| `default_when` | Bedingung | Vorauswahl. Weglassen → nichts vorausgewählt. |
| `bind` | Pfad | Üblich: `dataParameters.selections.<name>` (siehe [`data_parameters:`](#de-data-protection)). |

Wird die Zuordnung in Schritt 2 geändert und erneut bestätigt, baut sich Schritt 3 neu auf: Werte, die schon angeboten wurden, behalten ihren Haken; neue Werte folgen `default_when`. Die Schritte 4 und 5 schließen sich, bis erneut „Weiter" gedrückt wird.

<a id="de-localized-labels"></a>

### Lokalisierte Beschriftungen (`label:`)

Die Oberfläche wird in **Deutsch (Standard)** und **Englisch** ausgeliefert, umschaltbar über die Sprachauswahl oben in der App (derzeit ausgeblendet — die App läuft vorerst nur auf Deutsch; englische Labels bleiben dennoch gültig). Daher kann jedes `label:` in **zwei Formen** geschrieben werden:

- **Als einfacher String** — wird in jeder Sprache wörtlich verwendet:

  ```yaml
  title:
    label: "Titel"
  ```

- **Als Sprachzuordnung** — ein Eintrag je Sprache; die App wählt den Eintrag passend zur aktiven Oberflächensprache:

  ```yaml
  title:
    label:
      de: "Titel"
      en: "Title"
  ```

**Wo es gilt.** Überall, wo ein `label:` vorkommt — sowohl `parameters.<key>.label` als auch `template.files[].label`.

**Auflösungsreihenfolge.** aktive Sprache → Standardsprache (`de`) → erster vorhandener Eintrag → Parameterschlüssel (als letzter Rückfall). Eine Zuordnung, der die aktuelle Sprache fehlt, ergibt also trotzdem etwas Sinnvolles; eine in beiden Sprachen identische Beschriftung kann ein einfacher String bleiben.

**Beim Sprachwechsel** wird die Konfiguration neu eingelesen und jede Beschriftung neu aufgelöst — das Formular wird ohne Neuladen in der gewählten Sprache neu dargestellt.

**Nicht übersetzt:** Options-*Werte* (die `options:`-Liste) sind Daten/IDs (z. B. `okabe-ito`, `portrait`), kein Anzeigetext, und werden in jeder Sprache unverändert verwendet.

> Die Sprachschicht (`src/modules/i18n/`) lokalisiert auch sämtlichen Programmtext — Schaltflächen, Schrittüberschriften, Prüfwarnungen, Fehlermeldungen und Diagramm-Alternativtexte. Die Konfigurationsbeschriftungen sind der vom Entwickler verfasste Teil dieser Oberfläche.

<a id="de-standalone-vs-bound"></a>

### Eigenständige vs. gebundene Parameter

Ein Parameter ist entweder **eigenständig** (eine Vorlagenvariable, vorbelegt aus `default:`) oder über `bind:` an ein Blatt an anderer Stelle in `config.yaml` **gebunden**.

| | Eigenständig | Gebunden |
|---|---|---|
| Hat `default:` | Ja — die Vorgabe | Nein — die Vorgabe ist das gebundene Blatt |
| Hat `bind:` | Nein | Ja (Punktpfad, z. B. `export.font.size`) |
| Verwendet von | Vorlagenersetzung (`{{title}}`) | Renderer / Exporter (nachdem das gebundene Blatt überschrieben wurde) |

**Auflösungsregel.** Zur Laufzeit wird der vom Nutzer eingegebene Wert jedes gebundenen Parameters an seinen `bind:`-Pfad zurückgeschrieben, bevor Renderer und Exporter die Konfiguration sehen. Eigenständige Parameter verbleiben in der Parameterzuordnung und werden als `{{key}}` in die Markdown-Vorlage eingesetzt.

**Warum `bind:` verwenden?** Damit lässt sich jedes Konfigurationsblatt als pro-Bericht umschaltbare Nutzeroption verfügbar machen, ohne den Wert zu duplizieren oder die Überschreibung von Hand zu verdrahten. Bindet man z. B. `font_size` an `export.font.size`, steuert der Entwickler den Standard in der Konfiguration, und der Nutzer kann ihn pro Bericht überschreiben.

> **Wichtig — `bind:`-Pfade verwenden die `AppConfig`-Struktur (camelCase), nicht die rohen YAML-Schlüssel.** Die meisten Blätter heißen in beiden gleich (`export.font.size`, `export.page.orientation`), mehrwortige Schlüssel jedoch nicht: binde an `export.pageNumbers.position`, `export.sectionNumbering`, `dataParameters.smallestGroup` — **nicht** an die snake_case-Form `export.page_numbers.show` usw. Ein `bind:` auf einen nicht existierenden Pfad bleibt **stillschweigend wirkungslos** (die Überschreibung erreicht den Verbraucher nie). Der Parser bildet snake_case-YAML auf camelCase ab (siehe [src/modules/config/](src/modules/config/index.ts)).

<a id="de-parameter-types"></a>

### Parametertypen

| `type:` | Dargestellt als | Erfasster Wert |
|---|---|---|
| `text` | Texteingabe | String |
| `number` | Zahleneingabe | Zahl |
| `date` | Datumsauswahl | ISO-Datums-String |
| `select` | Auswahlliste (oder Radio bei `palette`/`font`) | String |
| `multiselect` | Mehrfachauswahl-Liste | `string[]` |
| `boolean` | Kontrollkästchen | Boolean |
| `color` | Nativer Farbwähler (`<input type="color">`) | Hex-String mit `#` (`#rrggbb`) |

`select` und `multiselect` benötigen eine `options:`-Liste:

```yaml
page_orientation:
  label:
    de: "Seitenausrichtung"
    en: "Page orientation"
  type: select
  bind: export.page.orientation
  options: [portrait, landscape]   # Werte werden nicht übersetzt
```

<a id="de-special-keys"></a>

### Besondere Parameterschlüssel (`palette`, `font`, `page_orientation`, `page_numbers`)

Vier Parameterschlüssel erhalten maßgeschneiderte UI-Elemente:

- **`palette`** — Radiogruppe; jede Option zeigt den Palettennamen und einen waagerechten Streifen ihrer tatsächlichen Farbmuster. Gebunden an `charts.palette`. Optionen müssen Paletten-IDs aus [src/modules/palettes/](src/modules/palettes/index.ts) entsprechen (`okabe-ito`, `tol-bright`, `tol-muted`, `ibm`, `grayscale`). Farbt die Segmente gestapelter Balkendiagramme (ein Farbton pro Zeile) sowie — als Fallback — jede nicht geschlechtsspezifische Kategorie in anderen Diagrammtypen.
- **`font`** — Radiogruppe; jede Optionsbeschriftung wird in der jeweiligen Schriftart dargestellt. An nichts gebunden (kuratiertes Thema — bildet eine Schrift-ID auf einen CSS-Stack, eine DOCX-Familie und einen Anzeigenamen ab, via [src/modules/fonts/](src/modules/fonts/index.ts)). Optionen müssen Schrift-IDs entsprechen (`verdana`, `tahoma`, `arial`, `georgia`).
- **`page_orientation`** — Icon-Radios mit Seitenform-Symbolen (Hoch-/Querformat) statt Text. Gebunden an `export.page.orientation`. Optionen: `portrait`, `landscape`. Werte sind übersetzungsfrei; die Beschriftungen kommen aus dem i18n-Modul.
- **`page_numbers`** — Icon-Radios mit Seitensymbolen für die Position der Seitenzahl. Gebunden an `export.pageNumbers.position`. Optionen: `left`, `center`, `right`, `none` (`none` blendet die Seitenzahl aus).

Alle Schlüssel folgen weiterhin dem Standardschema (einschließlich lokalisierter `label:`); nur ihre UI-Darstellung ist besonders.

Zusätzlich gibt es zwei Farbwähler-Parameter (`type: color`): `gender_color_male` / `gender_color_female`, gebunden an `charts.gender.male` / `charts.gender.female`. Da jedes Kreuztabellen-Diagramm in dieser Konfiguration nach „Geschlecht" aufgeschlüsselt ist, steuern diese beiden Farben die Einfärbung in jedem Diagrammtyp **außer** gestapelten Balkendiagrammen, die stattdessen `palette` verwenden (ein Balken kann mehr Segmente haben, als Geschlechterfarben zur Verfügung stehen) — siehe [`charts:`](#de-charts).

---

<a id="de-data"></a>

## `data:`

Deklariert die Datenquellen, deren Upload die App erwartet, jeweils mit einem oder mehreren Tabellenblättern und ihren Spalten. Diese Namen sind **Zuordnungsziele**: Der Nutzer wählt zuerst ein Format (XLSX oder CSV) und ordnet dann die tatsächlichen Blätter/Spalten seiner Datei diesen Namen zu (per Namensgleichheit vorausgewählt). Es ist also **keine starre Validierung** mehr — die deklarierten Namen müssen in der Datei nicht exakt vorkommen.

```yaml
data:
  Datensatz:
    sheets:
      - sheet: Blatt 1
        definition: "Worum es in diesem Blatt geht."     # optional
        notes: "Weitere Hinweise."                       # optional
        include: [full]                                   # optional; weglassen ⇒ alle Vorlagen
        columns:
          - Spalte 1                                       # Kurzform: nur der Name
          - column: Spalte 2                               # Langform mit Metadaten
            definition: "Definition der Spalte."           # optional
            notes: "Weitere Hinweise."                     # optional
            include: [full, mandatory]                     # optional; weglassen ⇒ alle Vorlagen
      - sheet: Blatt 2
        columns: [Spalte A, Spalte B]
```

| Feld | Typ | Anmerkungen |
|---|---|---|
| `<Quellname>` | Objekt | Der oberste Schlüssel ist die in der Upload-Oberfläche angezeigte Quellkennung. |
| `.sheets[].sheet` | String | Name des Excel-Tabellenblatts, wie er in der Arbeitsmappe erscheint. |
| `.sheets[].definition` | String | Optional. Definition des Blatts (nur Deutsch), als Tooltip angezeigt — siehe [Tooltips](#de-tooltips). `description:` wird als veraltetes Synonym noch akzeptiert. |
| `.sheets[].info` | String \| Sprachzuordnung | Optional. Zweisprachiger Tooltip-Text; hat Vorrang vor `definition`. |
| `.sheets[].notes` | String | Optional. Weitere Hinweise zum Blatt (Metadaten) — z. B. Begriffsdefinitionen, die sich keiner einzelnen Spalte zuordnen lassen. |
| `.sheets[].include` | `string[]` | Optional. Liste der Vorlagen-`id`s (siehe [`template:`](#de-template)), für die dieses Blatt im Datenschritt abgefragt wird. **Weglassen ⇒ alle Vorlagen.** |
| `.sheets[].columns` | Liste aus String **oder** Objekt | Pflicht-Spaltenüberschriften (verglichen nach Unicode-NFC- und Leerraum-Normalisierung). Eine Spalte kann ein einfacher String sein oder ein Objekt mit `column:` (alias `name:`) plus optional `definition:`, `info:`, `notes:`, `include:` (gleiche Semantik wie auf Blattebene). |

**Zuordnung statt Validierung.** Im Datenschritt wählt der Nutzer **XLSX** (eine Arbeitsmappe je Quelle; jedes Konfig-Blatt → ein Blatt der Mappe) oder **CSV** (eine Einzeltabellen-Datei je Blatt; akzeptiert auch eine einblättrige `.xlsx`) und ordnet je Blatt/Spalte über ein Auswahlfeld zu. Die nach Name passende Option ist vorausgewählt. Nicht zugeordnete Blätter/Spalten erzeugen beim „Weiter" **nicht-blockierende Warnungen** (in der gewählten Sprache); die Verarbeitung läuft weiter, und Blöcke, die auf fehlende Daten verweisen, werden als roter „TBD"-Hinweis dargestellt. Zugeordnete Spalten werden auf die Konfig-Spaltennamen **umbenannt**.

**DataStore-Schlüssel.** Intern wird jedes geladene Blatt unter seinem Blattnamen abgelegt. Diagramm- und Tabellenblöcke verweisen über diesen Schlüssel auf Daten — z. B. sucht `data: Blatt 1` in einem Diagrammblock `DataStore["Blatt 1"]`.

**Vorlagenabhängiger Datenschritt.** Der Datenschritt fragt nur die Daten ab, die die gewählte Vorlage tatsächlich nutzt — in zwei Stufen: Zuerst greift die manuelle `include:`-Filterung (Blätter/Spalten, deren `include` die `id` der Vorlage enthält bzw. die kein `include` haben). Anschließend berechnet die App aus den Diagramm-/Tabellenblöcken der Vorlage automatisch die **benötigten Spalten** (`groupby.rows`/`cols`, `value`, echte `filter`-Spalten) und löst sie durch die Preprocessing-Pipeline zu physischen Spalten auf: abgeleitete Spalten benötigen ihre `from`-Quellspalte, per Join gelieferte Spalten das rechte Blatt samt Join-Schlüsseln auf beiden Seiten. Nicht benötigte Blätter/Spalten werden gar nicht abgefragt und erzeugen keine Warnungen.

**Hinweis zu den `Zeitraum_*`-Blättern.** Aus den `Zeitraum_*`-Ereignisblättern wurden Spalten bewusst entfernt, die Stammdaten doppelt führten — diese werden zur Laufzeit über den Join mit `Schueler` (Schlüssel `SchuelerID`) ergänzt (siehe [`preprocessing:`](#de-preprocessing)). Ausnahme: `Zeitraum_Anmeldung` hat einen eigenen Schlüssel (`AnmeldeID`) und wird nicht mit `Schueler` verknüpft, behält seine Merkmale also direkt.

<a id="de-tooltips"></a>

**Tooltips (`definition` / `info`).** Vorlagen, Blätter, Spalten und Parameter können erklärenden Tooltip-Text tragen. In der App erscheint daneben ein anklickbares **ⓘ**-Symbol, das den Text als kleines Popup zeigt (Klick außerhalb oder Esc schließt es). Zwei Felder:
- `definition` — **nur Deutsch** (einfacher String). In jeder Sprache derselbe Text.
- `info` — **zweisprachig** (`{ de, en }` oder einfacher String), zur Build-Zeit wie `label` an die aktive Sprache gebunden.

Sind beide vorhanden, gewinnt `info`. Fehlen beide, wird kein ⓘ angezeigt. Auf Mutationen (abgeleitete Spalten, siehe [`preprocessing:`](#de-preprocessing)) ist `definition` ebenfalls erlaubt. Die Tooltips der drei Schritte (Vorlage, Daten, Parameter) stammen aus dem i18n-Modul.

---

<a id="de-preprocessing"></a>

## `preprocessing:`

Optionale, abgeleitete Spalten und Datensätze, die **zwischen Datenladen und Rendering** aus den geladenen Blättern gebildet werden. Zwei Operationen: **`mutations`** (abgeleitete Spalten) laufen zuerst, danach **`joins`**. Ergebnisse werden im DataStore abgelegt und können in Vorlagen wie normale Blätter referenziert werden (`data: <name>`).

> Dieser Abschnitt steht in derselben Datei wie [`data:`](#de-data) (`config/data.yaml`), da Mutationen und Joins direkt auf den dort definierten Blättern arbeiten.

### `mutations` — abgeleitete Spalten (Wenn-Dann-Sonst)

Eine Mutation fügt einem Datensatz eine Spalte mit einer **einfachen Wenn-Dann-Sonst-Regel** hinzu: Wo die Bedingung für den `from`-Wert zutrifft, erhält die neue `column` den `then`-Wert, sonst `else` (Standard `""`). So leitet der mitgelieferte Schuljahresbericht die Spalte `Oberstufe` aus der `Jahrgangsstufe` ab und Ereignis-Flags wie `Wiederholung` aus dem `Ergebnis` einer Vorrückungsentscheidung.

```yaml
preprocessing:
  mutations:
    - dataset: Schueler                          # Datensatz, der die Spalte erhält
      column: Oberstufe                          # neue (oder überschriebene) Spalte
      definition: "Zugehörigkeit zur Oberstufe …"     # optional (Metadaten)
      from: Jahrgangsstufe                       # Quellspalte, die die Bedingung testet
      when: { gte: 11 }                          # Bedingung (weglassen → „Wert ist truthy")
      then: "Ja"
      else: "Nein"                               # optional (Standard "")
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `dataset` | String | — | Datensatz, dem die Spalte hinzugefügt wird (in eine abgeleitete Kopie). |
| `column` | String | — | Name der neuen (oder überschriebenen) Spalte. |
| `definition` | String | — | Optional. Definition der abgeleiteten Spalte (Metadaten), analog zu `.sheets[].columns[].definition`. |
| `from` | String oder Liste | — | Quellspalte(n). Die Wenn-Dann-Sonst-Form testet die (erste) Spalte; eine `fn`-Mutation erhält alle aufgeführten Spalten in dieser Reihenfolge. |
| `when` | Objekt | truthy | Bedingung auf `from` (siehe Operatoren). Weglassen → „Wert ist truthy". |
| `then` | beliebig | — | Wert, wenn die Bedingung zutrifft. |
| `else` | beliebig | `""` | Wert sonst. |
| `fn` | String | — | Name einer Transformationsfunktion (siehe unten). Gesetzt → die Funktion berechnet die Spalte, `when`/`cases`/`else` werden ignoriert. |
| `options` | Objekt | `{}` | Wird der `fn`-Funktion unverändert übergeben. |

**Bedingungsoperatoren** (innerhalb `when`, per UND verknüpft; skalare Operatoren akzeptieren auch eine Liste = „eines davon"): `equals`, `not_equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches` (Regex), `gt`/`gte`/`lt`/`lte` (numerisch), `empty` (bool), `truthy` (bool — `true`/`Ja`/`Yes`/`1`). String-Vergleiche sind NFC-normalisiert und getrimmt.

**Wertelisten aus der Konfiguration.** Statt einer festen Liste darf `equals`, `in`, `not_equals`, `contains`, `starts_with` oder `ends_with` einen Verweis `{ from_config: <Pfad> }` tragen — so liest eine Mutation die Auswahl einer [Checkliste aus Schritt 3](#de-parameters): `when: { in: { from_config: dataParameters.selections.mint_profiles } }`. Aufgelöst wird gegen die Konfiguration **nach** dem Einmischen der Nutzereingaben; ein nicht auflösbarer Pfad ergibt eine leere Liste, die nichts trifft. (In `validation:`-Regeln wird ein solcher Verweis nicht aufgelöst und trifft ebenfalls nichts.)

### `fn` — berechnete Spalten über eine Transformationsfunktion

Manche Ableitungen lassen sich nicht als Wenn-Dann-Sonst formulieren — Datumsarithmetik, laufende Summen, Nachschlagetabellen. Statt dafür Operatoren in die App aufzunehmen, benennt `fn:` eine **TypeScript-Funktion**, die neben der Konfiguration liegt: jeder benannte Export aus `config/functions/*.ts` wird beim Build automatisch registriert. Der `src/`-Baum bleibt dadurch frei von projektspezifischer Fachlogik — eine neue Ableitung heißt: eine Funktion hier ergänzen und in der YAML benennen.

```yaml
preprocessing:
  mutations:
    - dataset: Zeitraum_Beurlaubung
      column: "Beurlaubungsdauer"
      definition: "Anzahl der Beurlaubungstage im Berichtszeitraum."
      fn: date_difference                        # benannter Export aus config/functions/*.ts
      from: [Beurlaubungsende, Beurlaubungsbeginn]  # Spalten, in dieser Reihenfolge
      options:                                   # geht unverändert an die Funktion
        inclusive: true
        min: 0
```

Eine Transformation arbeitet **spaltenweise, nicht zeilenweise**: sie erhält je `from`-Spalte ein Array (zeilengleich indiziert) und liefert die fertige Spalte als Array zurück.

```ts
// config/functions/dates.ts
import type { ColumnTransform } from "../../src/modules/transforms";

export const date_difference: ColumnTransform = (columns, ctx) => {
  const [ende, beginn] = columns;          // columns[i] = die Spalte aus from[i]
  return Array.from({ length: ctx.rowCount }, (_, r) => /* … */ 0);
};
```

`ctx` enthält `rowCount` (die geforderte Länge des Rückgabe-Arrays), `options`, `dataset` und `column`. Nichts wird aus einem String ausgewertet — es gibt kein `eval`/`new Function`, die strikte CSP bleibt unberührt.

Fehler blockieren nie, sondern erscheinen als Warnung, und die Spalte wird **nicht** angelegt (im Unterschied zur Wenn-Dann-Sonst-Form, die dann auf `else` zurückfällt):

| Situation | Verhalten |
|---|---|
| `fn` nicht registriert | Warnung; Spalte fehlt. |
| Eine `from`-Spalte fehlt im Datensatz | Warnung; Spalte fehlt (die Funktion läuft gar nicht erst mit `undefined`-Werten). |
| Funktion wirft | Warnung mit Fehlermeldung; Spalte fehlt. |
| Rückgabe ist kein Array oder hat die falsche Länge | Warnung; Spalte fehlt. |
| Derselbe Name in zwei Dateien | Warnung; der zuletzt geladene Export gewinnt. |

`requiredDataForBlocks` löst **alle** `from`-Spalten auf, sodass die Mapping-Oberfläche jede benötigte Quellspalte anfordert.

### `joins`

Zeilen aus einem Blatt mit Spalten anreichern, die über einen gemeinsamen Schlüssel in einem anderen Blatt nachgeschlagen werden. Das Ergebnis wird unter `name` abgelegt; `name` = `left` reichert die Quelle direkt an.

```yaml
preprocessing:
  joins:
    - name: Zeitraum_Vorrueckung    # Ausgabe-Datensatz (= left → reichert in place an)
      left: Zeitraum_Vorrueckung    # Basis; eine Ausgabezeile je left-Zeile (left join)
      right: Schueler               # nachgeschlagenes Blatt
      on: SchuelerID                # gemeinsamer Schlüssel (oder left_on / right_on)
      type: left                    # left (unpassende behalten) | inner (verwerfen)
      # select weglassen → alle right-Spalten übernehmen, die links fehlen
      # select: [Stufe, {column: Klasse, as: Klassenbezeichnung}]   # explizit
      # prefix: "ST_"               # Präfix für übernommene Spaltennamen
      # indicator: "matched"        # bool-Spalte: hat die left-Zeile gematcht?
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `name` | String | — | Name des Ausgabe-Datensatzes (von `data:`-Blöcken referenziert). `name` = `left` reichert die Quelle direkt an. |
| `left` | String | — | Basis-Datensatz; eine Ausgabezeile je left-Zeile (bei `left`). |
| `right` | String | — | Datensatz, in dem nachgeschlagen wird. |
| `on` | String | — | Schlüssel in beiden Blättern (Kurzform für gleiches `left_on`/`right_on`). |
| `left_on` / `right_on` | String | — | Schlüssel mit unterschiedlichen Namen je Seite. |
| `type` | Enum | `left` | `left` (unpassende left-Zeilen behalten) \| `inner` (verwerfen). |
| `select` | Liste | alle | Zu übernehmende right-Spalten. Weglassen → alle, die nicht der Schlüssel und nicht bereits links vorhanden sind. Eintrag: Spaltenname oder `{ column, as }` (Umbenennung). |
| `prefix` | String | `""` | Wird jedem übernommenen Spaltennamen vorangestellt (Kollisionsschutz). |
| `indicator` | String | — | Optionale bool-Spalte: hat die left-Zeile eine right-Zeile getroffen? |

**Semantik.**
- **First-Match-Lookup**, kein SQL-Kreuzprodukt — eine left-Zeile erscheint höchstens einmal, auch wenn mehrere right-Zeilen denselben Schlüssel haben (Zählungen/Anteile bleiben stabil).
- `type: left` behält unpassende left-Zeilen (übernommene Spalten leer, `indicator` false); `type: inner` verwirft sie.
- `select` weggelassen → Anreicherung: alle right-Spalten außer dem Schlüssel und außer bereits links vorhandenen. Explizites `select` prüft jeden Namen gegen das right-Schema (fehlend → Warnung, übersprungen).
- Joins laufen **in Reihenfolge, nach allen Mutationen**; ein späterer Join darf die Ausgabe eines früheren verwenden, und Joins tragen per Mutation abgeleitete Spalten weiter.
- Schlüssel werden nach NFC- und Leerraum-Normalisierung verglichen.

**Warum der Schuljahresbericht beides braucht.** Die `Zeitraum_*`-Ereignisblätter (z. B. `Zeitraum_Vorrueckung`) enthalten nur Ereignisdaten. Mutationen leiten die `Stufe` (aus der `Jahrgangsstufe`) auf `Schueler` ab sowie die Flags `Vorgerückt` / `Wiederholung` (aus dem `Ergebnis`) auf dem Ereignisblatt; der Join `Schueler → Zeitraum_Vorrueckung` trägt die Stufe dann über `SchuelerID` an jede Entscheidung. Zusammen liefern sie jede Spalte, die die Vorrückungs-Diagramme in `groupby:`, `filter:` und `value:` referenzieren.

Strukturelle Probleme (fehlendes Blatt, fehlender Schlüssel, fehlende Spalte, keine Treffer) erscheinen als **nicht-blockierende Warnungen** im selben gelben Banner wie die Datenprüfung — der Build bricht nie ab.

---

<a id="de-template"></a>

## `template:`

Listet die gebündelten Markdown-Vorlagen, aus denen der Nutzer in Schritt 2 wählt.

```yaml
template:
  files:
    - id: full                        # optional, übersetzungsfreie Kennung
      label: "Standardbericht"        # einfacher String oder eine Sprachzuordnung:
      file: report_template.md
    - id: summary
      label:
        de: "Kurzfassung"
        en: "Quick Summary"
      file: summary_template.md
```

| Feld | Typ | Anmerkungen |
|---|---|---|
| `files[].id` | String | Optional. Stabile, übersetzungsfreie Kennung, auf die die `include:`-Listen im [`data:`](#de-data)-Abschnitt verweisen. Bei Auswahl dieser Vorlage zeigt der Datenschritt nur die Blätter/Spalten, deren `include` diese `id` enthält (bzw. ohne `include`). |
| `files[].label` | String \| Sprachzuordnung | Lesbarer Name in der Radioauswahl. Lokalisierbar wie jedes `label:` — siehe [Lokalisierte Beschriftungen](#de-localized-labels). |
| `files[].definition` | String | Optional. Deutscher Tooltip-Text zur Vorlage — siehe [Tooltips](#de-tooltips). |
| `files[].info` | String \| Sprachzuordnung | Optional. Zweisprachiger Tooltip-Text; hat Vorrang vor `definition`. |
| `files[].file` | String | Dateiname im gebündelten Verzeichnis `templates/` (ohne Pfad). |

**Bündelung.** Jede `.md`-Datei unter `/templates/` wird zur Build-Zeit über `import.meta.glob` in das JS-Bundle aufgenommen. Es gibt keinen Laufzeit-Abruf (die CSP verbietet `connect-src`), daher muss die Datei zur Build-Zeit existieren.

**Generiert, nicht von Hand gepflegt.** Die Dateien unter `templates/` sind **Build-Artefakte** (git-ignoriert). Sie werden von `scripts/gen-templates.ts` (`npm run gen:templates`, als `predev`/`prebuild`/`pretest`-Hook verdrahtet) aus zwei Quellen zusammengesetzt: dem Prosa-Gerüst `templates/master.md` (mit den Generierungs-Platzhaltern `{{questions}}` und `{{tables}}`) und dem [Fragenkatalog](#de-template-questions) `template.questions`. Für jeden Eintrag mit `id` **und** `file` wird die zusammengesetzte Vorlage nach `templates/<file>` geschrieben. Prosa kann weiterhin mit Abschnittsmarkern (`<!-- include: <id> -->` … `<!-- /include -->`, unmarkierter Inhalt landet in jeder Vorlage) auf einzelne Vorlagen begrenzt werden. Bearbeiten Sie `templates/master.md` und `config/template.yaml`, nicht die generierten Dateien.

**Hard-Fail-Verhalten.** Ist eine hier referenzierte `file:` nicht im Bundle vorhanden, bricht die App beim Start ab und listet Fehlendes und Verfügbares auf. Das fängt Tippfehler und vergessene Dateien früh ab.

**Minimum: ein Eintrag.** Eine leere `files:`-Liste führt ebenfalls zum Hard-Fail.

<a id="de-template-questions"></a>

### Fragenkatalog (`template.questions`)

Eine flache, **geordnete** Liste, die ausschließlich vom Generator gelesen wird — der Laufzeit-Config-Parser ignoriert den Schlüssel. Sie wird in den Platzhalter `{{questions}}` des Masters gerendert; `{{tables}}` (im Anhang → Tabellen) erhält je Frage einen `table`-Block mit derselben Spezifikation und derselben `caption`, gegliedert nach denselben Abschnitten wie die Situationsbeschreibung (eine Ebene tiefer, ohne Definitionen/Fazit). Zwei Eintragstypen, unterschieden am ersten Schlüssel:

```yaml
template:
  questions:
    - section: Förderung                # "### …"-Überschrift + Definitionen-Callout;
      definitions:                      # ein Fazit-Callout wird automatisch nach der
                                        #   letzten Frage des Abschnitts angehängt.
        # Einträge verweisen auf die definition:-Texte in data.yaml (Spalten,
        # abgeleitete Spalten, Blätter — eine einzige Quelle für den Wortlaut):
        - Förderart
        - term: Bewilligt               # angezeigter Begriff ≠ data.yaml-Name
          ref: "Fördermaßnahme bewilligt"
        - term: Förderbedarf            # Konzept ohne data.yaml-Eintrag → Text inline
          text: "Gibt an, ob …"

    - title: "Wie viele Fördermaßnahmen wurden bewilligt?"
      include: full                     # Vorlagen-id(s); weglassen ⇒ jede Vorlage
      comment: Optional                 # kursive Statuszeile unter der Überschrift
      datenquelle: "Förderkoordination, Eigene Liste"
      personenkreis: Alle
      caption: "Anzahl der bewilligten Fördermaßnahmen nach Geschlecht."
      text:                             # weglassen ⇒ Standard-Freitext-Platzhalter
      table:                            # gemeinsame Kreuztabellen-Spezifikation
        data: Zeitraum_Foerdermassnahme
        filter: Alle                    # optionaler Zeilenfilter (truthy-Spalte)
        groupby:
          rows: Geschlecht              # Spaltenname, Liste [a, b] (Bucket nach Wertetupel) oder weglassen ⇒ eine „Total“-Zeile
          # cols: Geschlecht            # optional: Tabellenspalten / Diagramm-Serien
        aggregation: count              # Standard: count
        # value: <Spalte>               # Pflicht bei sum/mean/min/max/median/share_group
        # format: currency              # optionales Zellformat (integer|decimal|percent|currency)
      chart:                            # nur Darstellung
        type: bar                       # bar | line | pie | doughnut | pyramid | distance
        # stacked: true                 # bar/line: Serien stapeln
        title: Personen mit LK nach Geschlecht
```

| Feld | Typ | Anmerkungen |
|---|---|---|
| `section` | String | Abschnittseintrag: emittiert `### <section>` im Dokument und `#### <section>` im Tabellen-Anhang; Abschnitte ohne enthaltene Frage werden komplett übersprungen. |
| `definitions` | Liste | Einträge des `Definitionen`-Callouts, gerendert als `**Begriff**: Text`. Ein einfacher String schlägt sich selbst in data.yaml nach (Spalten in Dokumentreihenfolge, dann abgeleitete Spalten aus `preprocessing.mutations`, dann Blätter per Blattname); `{term, ref}` zeigt `term` an, löst aber `ref` auf; `{term, text}` gibt den Text wörtlich aus. Ein nicht auflösbarer `ref` bricht die Generierung ab — der Wortlaut lebt damit ausschließlich in den `definition:`-Feldern von data.yaml. |
| `title` | String | Frageeintrag: emittiert `#### <title>` im Dokument und `##### <title>` im Tabellen-Anhang. |
| `include` | String \| Liste | Vorlagen-id(s) aus `template.files[].id`; weglassen ⇒ jede Vorlage. |
| `comment` | String | Kursive Statuszeile (z. B. `Optional`, `Verpflichtend für …`). |
| `datenquelle`, `personenkreis` | String | Quellzeile `> Datenquelle: … · Personenkreis: … · Datensatz: <table.data>`. |
| `caption` | String | Bildunterschrift des Diagramms **und** Überschrift der Anhang-Tabelle. |
| `text` | String | Freitextabsatz; weglassen ⇒ Standard-Platzhalter. |
| `table` | Objekt | Kreuztabellen-Spezifikation (`data`, `filter`, `groupby.rows`/`cols`, `aggregation`, `value`, `format`) — identisch zum `table`-Blockformat der Vorlagen, siehe README.md → Template Format. |
| `chart` | Objekt | Darstellungsschlüssel: `type`, `stacked`, `title`, `alt`, `alt-intro`, `caption` (überschreibt die Frage-`caption`). |

Der Generator validiert den Katalog (genau einer von `section`/`title`; `table.data` Pflicht; `table.groupby.rows` muss ein Spaltenname oder eine nicht-leere Liste davon sein; Wert-Operationen benötigen `value:`; `include`-ids gegen `template.files[].id` geprüft) und bricht bei strukturellen Fehlern ab.

---

<a id="de-data-protection"></a>

## `data_parameters:`

Angaben zum **Datensatz** — welchen Zeitraum er abdeckt und ab welcher Gruppengröße Werte maskiert werden. Beides beantwortet der Nutzer über seine Daten, nicht über Layout oder Export; deshalb stehen sie zusammen. Der Abschnitt lebt in `config/data.yaml`, direkt bei den Blättern, auf die er sich bezieht.

> **Umbenannt.** Dieser Abschnitt hieß früher `data_protection:` und enthielt nur `smallest_group`. Der alte Name wird weiterhin gelesen (`data_parameters:` gewinnt, wenn beide vorkommen), sollte aber nicht mehr verwendet werden.

```yaml
data_parameters:
  smallest_group: 5                          # gebunden durch parameters.smallest_group
  period_start: last_year_start   # Token statt festem Datum — altert nicht
  period_end: last_year_end       # gebunden durch parameters.period_end
  category_order:                 # optional: feste Wertereihenfolge je Spalte
    Geschlecht: [männlich, weiblich]
    Arbeitszeitanteil: ["40", "50", "60", "70", "80", "90", "100"]
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `smallest_group` | Zahl | `5` | Aggregierte Werte strikt unterhalb dieses Werts und größer als null werden maskiert. |
| `period_start` | Datum oder Token | — | Erster Tag des Berichtszeitraums. |
| `period_end` | Datum oder Token | — | Letzter Tag des Berichtszeitraums. |
| `category_order` | Map: Spalte → Werteliste | — | Feste Anzeigereihenfolge für die Werte einer Spalte (siehe unten). |
| `selections` | Map: Name → Werteliste | — | Ziel der Checklisten aus Schritt 3 (`step: data`, gebunden an `dataParameters.selections.<name>`). Nicht in YAML vorzubelegen — die Vorauswahl kommt aus `default_when`. |

**`category_order`** legt für eine benannte Spalte eine feste Werteliste fest — ein "geordneter Faktor" — die überall gilt, wo diese Spalte eine Crosstab-Achse bildet. Ohne diese Angabe sortieren `wrangleTable`-Zeilen natürlich — Text alphabetisch, enthaltene Zahlen nach ihrem Wert (`E8` vor `E9` vor `E10`, `"40"` vor `"100"`) — und Spalten in Erstauftrittsreihenfolge; das passt nicht, wenn die Reihenfolge inhaltlich vorgegeben ist (z. B. `männlich` vor `weiblich` als Spalten, egal welcher Wert zuerst in den Daten steht). `category_order` greift bei `groupby.cols` immer und bei `groupby.rows`, wenn dort eine einzelne Spalte steht (eine Liste mehrerer Spalten — zusammengesetzte Zeilen — behält die natürliche Standardreihenfolge, da eine Reihenfolge über Werte-Tupel nicht eindeutig ist). Werte werden NFC-normalisiert und getrimmt verglichen (nicht groß-/kleinschreibungsunabhängig); Werte, die in den Daten vorkommen, aber nicht in der Liste stehen, werden in natürlicher Reihenfolge hinter die gelisteten Werte angehängt — die Liste muss also nicht vollständig sein.

**Relative Datums-Token.** Ein festes Datum in der Konfiguration altert — die Vorgabe müsste jeden Januar von Hand nachgezogen werden. Statt `"2025-01-01"` darf deshalb ein Token stehen, das beim Parsen gegen das aktuelle Datum aufgelöst wird:

| Token | Ergebnis |
|---|---|
| `last_year_start` / `last_year_end` | 1. Januar / 31. Dezember des Vorjahres |
| `this_year_start` / `this_year_end` | 1. Januar / 31. Dezember des laufenden Jahres |
| `today` | heutiges Datum |

Alles andere wird unverändert durchgereicht, explizite `JJJJ-MM-TT`-Daten funktionieren also weiter. Dieselben Token gelten für `clamp_start` / `clamp_end` einer `date_difference`-Mutation.

**Der Zeitraum im Preprocessing.** Braucht eine Berechnung den Zeitraum — etwa das Kappen der Beurlaubungsdauer —, verweist die Mutation mit `from_config:` auf den Pfad in der **aufgelösten** Konfiguration:

```yaml
      fn: date_difference
      from: [Beurlaubungsende, Beurlaubungsbeginn]
      options:
        clamp_start: { from_config: dataParameters.periodStart }
        clamp_end: { from_config: dataParameters.periodEnd }
```

„Aufgelöst" heißt: **nach** dem Einmischen der Nutzereingaben. Der Zeitraum wird in Schritt 1 abgefragt (`step: template`), das Preprocessing läuft im Schritt 3 „Datenvalidierung" — die Eingabe des Nutzers erreicht die Berechnung also tatsächlich, nicht nur die Vorgabe aus dieser Datei. Wer den Zeitraum im Formular auf ein Halbjahr verkleinert, bekommt entsprechend gekappte Dauern.

`from_config:` funktioniert für jede Option und jeden Konfigurationspfad; ein nicht auflösbarer Pfad ergibt `undefined` (die Funktion entscheidet, was das bedeutet), alles andere wird unverändert durchgereicht.


**Wo es gilt.** Bei **allen** Aggregationen, und zwar nach der **Gruppengröße**, nicht nach dem Wert: Eine Zelle wird maskiert, wenn ihr mindestens eine, aber weniger als `smallest_group` Quellzeilen zugrunde liegen. Identifizierend ist, wie wenige Personen hinter einer Zahl stehen — bei `count` ist das dasselbe wie der Wert, sonst nicht: Ein Mittelwert von 4.200 € über zwei Personen ist identifizierend, obwohl sein Wert weit über dem Schwellenwert liegt, während eine Durchschnittsnote von 3,2 über zehn Personen nichts preisgibt. Leere Zellen (0 Zeilen) werden nie maskiert.

**Wie maskiert dargestellt wird.** `<5` erscheint nur dort, wo die angezeigte Zahl **die Gruppengröße ist**, also bei `count`. Bei Mittelwert, Summe, Median, Minimum, Maximum und den Anteilsoperationen wäre `<5` schlicht falsch — dort steht ein neutraler Platzhalter („n. v."):

- **Tabellen:** `<5` bei `count`, sonst der Platzhalter.
- **Diagramme:** ein maskierter `count` wird auf den Schwellenwert geklemmt, sodass ein kleiner Balken weiterhin gezeichnet wird; alle anderen Aggregationen zeichnen **nichts** (0) — für einen unterdrückten Mittelwert gibt es keinen ehrlichen kleinen Ersatzwert, und ein erfundener Balken würde als echt gelesen. Tooltip und dauerhaftes Wertelabel zeigen denselben Text wie die Tabelle.
- **Alt-Texte:** in der Datenpunkt-Aufzählung erscheint `<5` bzw. ein ausgeschriebener Hinweis, damit Screenreader-Nutzende denselben Vorbehalt erhalten wie sehende Lesende.

---

<a id="de-export"></a>

## `export:`

DOCX-Gestaltung und Metadaten. Jedes Blatt hier ist ein Kandidat für eine `bind:`-Ausspielung in `parameters:`.

```yaml
export:
  filename: report.docx
  locale: de-DE
  section_numbering: false
  toc: false

  document:
    title: Report
    subject: ""
    creator: ""
    description: ""
    keywords: ""

  font:
    family: Arial
    size: 11
    heading_family: Arial
    color: "1A1A1A"

  headings:
    color: "1F3864"
    h1_size: 20
    h2_size: 16
    h3_size: 13
    h4_size: 12

  paragraph:
    alignment: left
    spacing_before: 0
    spacing_after: 120
    line_spacing: 276

  page:
    orientation: portrait
    width: 11906
    height: 16838
    margin:
      top: 1418
      right: 1418
      bottom: 1418
      left: 1418
      header: 709
      footer: 709

  page_numbers:
    position: center
    start: 1
    format: decimal

  header:
    text: ""

  footer:
    text: ""

  table:
    border_style: single
    border_color: "AAAAAA"
    border_size: 4
    cell_padding: 80

  definition_box:
    color: "1F77B4"
    background: true
  summary_box:
    color: "2CA02C"
    background: true
```

### Oberste Ebene

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `filename` | String | `report.docx` | Ausgabedateiname. |
| `locale` | String | `en-US` | BCP-47-Gebietsschema für Zahlen-/Währungsformatierung. (Unabhängig von der Oberflächensprache.) |
| `section_numbering` | Boolean | `false` | Nummeriert Abschnittsüberschriften `<h2>`–`<h5>` als `1.`, `1.1.`, `1.1.1.`, `1.1.1.1.` (die Anhang-Tabellen stehen auf `<h5>`; das Inhaltsverzeichnis führt nur `<h2>`–`<h4>`) — in der **Vorschau** über CSS-Zähler, im **DOCX** über mehrstufige Nummerierung pro Überschrift. Der Titel (`# {{title}}`, ein `<h1>`) wird als Dokumenttitel behandelt und nicht nummeriert. |
| `toc` | Boolean | `false` | Fügt ein Inhaltsverzeichnis **direkt vor der ersten `<h2>`** ein (nach Titel/Untertitel): ein Word-Verzeichnisfeld im **DOCX** und ein `<nav class="report-toc">` in der **Vorschau**. Die Verzeichnis-Überschrift erscheint in der aktiven Oberflächensprache. Word fragt beim ersten Öffnen, ob „Felder aktualisiert" werden sollen; die Einträge entstehen dann. |

### `document.*` — DOCX-Metadaten

Wird in die .docx-Dateieigenschaften geschrieben (Titel / Betreff / Autor / Beschreibung / Schlüsselwörter).

### `font.*` — Fließtext

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `family` | String | `Arial` | Fließtextschrift (zur Laufzeit durch den `font`-Parameter überschrieben). |
| `size` | Zahl (pt) | `11` | Fließtextgröße. |
| `heading_family` | String | erbt `family` | Optionale Überschreibung für die Überschriftenschrift. |
| `color` | Hex ohne `#` | `1A1A1A` | Fließtextfarbe. |

### `headings.*`

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `color` | Hex ohne `#` | `1F3864` | Gilt für alle Überschriftenebenen, sofern nicht überschrieben. |
| `h1_size`–`h4_size` | Zahl (pt) | `20`, `16`, `13`, `12` | Größen je Ebene. |

### `paragraph.*`

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `alignment` | Enum | `left` | `left` \| `center` \| `right` \| `justify` |
| `spacing_before` | Twips | `0` | Abstand vor dem Absatz. |
| `spacing_after` | Twips | `120` (≈6 pt) | Abstand nach dem Absatz. |
| `line_spacing` | Twips | `276` | `276` ≈ einfach bei 11 pt; `360` ≈ 1,5×; `480` ≈ doppelt. |

### `page.*`

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `orientation` | Enum | `portrait` | `portrait` \| `landscape`; tauscht die A4-Maße automatisch. |
| `width`, `height` | Twips | A4 (11906 × 16838) | Nur überschreiben, wenn nicht A4. |
| `margin.top` / `.right` / `.bottom` / `.left` | Twips | `1418` (~25 mm) | |
| `margin.header` / `.footer` | Twips | `709` (~12 mm) | Abstand vom Seitenrand zum Kopf-/Fußzeileninhalt. |

> **Twips-Auffrischung.** 1 mm ≈ 56,7 Twips. 1 Zoll = 1440 Twips. 1 pt = 20 Twips.

### `page_numbers.*`

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `position` | Enum | `center` | Platzierung der Seitenzahl in der Fußzeile: `left` \| `center` \| `right` \| `none` (`none` blendet sie aus). Die Zahl wird schlicht dargestellt (z. B. `1`), ohne Gesamtzahl. Das veraltete `show: false` wirkt weiterhin wie `position: none`. |
| `start` | Zahl | `1` | Startseitennummer. |
| `format` | Enum | `decimal` | `decimal` \| `upperRoman` \| `lowerRoman` \| `upperLetter` \| `lowerLetter`. |

### `header.text`, `footer.text`

Statische Zeichenketten in der Kopfzeile (linksbündig) und der Fußzeile (links neben den Seitenzahlen).

### `table.*`

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `border_style` | Enum | `single` | `single` \| `double` \| `dashed` \| `dotted` \| `thick` \| `none`. |
| `border_color` | Hex ohne `#` | `999999` | |
| `border_size` | Achtel-pt | `4` | |
| `cell_padding` | Twips | `80` (~1,5 mm) | |

### `definition_box.*` und `summary_box.*`

Stilüberschreibungen für Callout-Blöcke. `definition_box` gestaltet `::: {.callout-note} … :::`; `summary_box` gestaltet `::: {.callout-tip} … :::`.

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `color` | Hex ohne `#` | `1F77B4` / `2CA02C` | Bestimmt linken Rand und Titelfarbe. |
| `background` | Boolean | `true` | Bei `true` wird die Zelle mit einem hellen, aus `color` abgeleiteten Ton gefüllt; bei `false` keine Füllung. |

---

<a id="de-charts"></a>

## `charts:`

Globale Chart.js-Standardwerte, die auf jedes Diagramm in jeder Vorlage angewendet werden.

```yaml
charts:
  palette: okabe-ito
  animation: false
  aspect_ratio: 2.0
  max_height_ratio: 1.0

  gender:
    male: "#0072B2"
    female: "#CC79A7"

  font:
    family: Arial
    size: 12
    color: "555555"

  title:
    display: true
    position: top
    align: center
    color: "1A1A1A"

  legend:
    display: true
    position: top
    align: center

  tooltip:
    enabled: true

  scales:
    x:
      begin_at_zero: false
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"
    y:
      begin_at_zero: true
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"
      trim_to_data: false

  elements:
    line:
      tension: 0.0
      point_radius: 3
    bar:
      border_radius: 0
      bar_percentage: 0.9
      max_columns: 10
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `palette` | Paletten-ID | `okabe-ito` | Farbe für die Segmente gestapelter Balkendiagramme (ein Farbton pro Zeile) sowie Fallback-Farbquelle für jede nicht geschlechtsspezifische Kategorie in anderen Diagrammtypen. Gebunden an `parameters.palette` (Radiogruppe). |
| `gender.male` | Hex mit `#` | `#0072B2` | Farbe für jeden Kategoriewert, der (NFC + trim + lowercase) zu „männlich" normalisiert — auf jeder Achse (rows oder cols), in jedem Diagrammtyp **außer** gestapelten Balkendiagrammen (dort greift `palette`). Gebunden an `parameters.gender_color_male` (Farbwähler). |
| `gender.female` | Hex mit `#` | `#CC79A7` | Wie `gender.male`, für „weiblich". Gebunden an `parameters.gender_color_female`. |
| `animation` | Boolean | `false` | Für Berichte deaktivieren — Animationen lassen sich nicht in .docx übertragen. |
| `aspect_ratio` | Zahl | `2.0` | Breite:Höhe. Beeinflusst die Bildschirmdarstellung und die eingebettete Bildgröße. |
| `max_height_ratio` | Zahl | – (aus) | Größte erlaubte Diagrammhöhe als Vielfaches der Diagrammbreite (Höhe ÷ Breite; `1.0` = quadratisch). Ein waagerechtes Balkendiagramm (siehe `elements.bar.max_columns`), das höher würde, wird in die wenigsten gleich großen Teildiagramme aufgeteilt, die jeweils hineinpassen (Kategorienzahl je Teil unterscheidet sich höchstens um eins). Alle Teile teilen sich dieselbe Werteachse, stehen in einer gemeinsamen Abbildung mit einer Bildunterschrift und erhalten je einen eigenen Alternativtext mit „Teil i von k“; im DOCX wird jeder Teil ein eigenes Bild. |
| `font.family` | String | `Arial` | Zur Laufzeit durch den `font`-Parameter überschrieben. |
| `font.size` | Zahl (pt) | `12` | Für Achsenbeschriftungen und Legende. |
| `font.color` | Hex ohne `#` | `555555` | |
| `title.display` | Boolean | `true` | `false` blendet den Titel bei jedem Diagramm aus, unabhängig vom `title:`-Feld des Blocks. |
| `title.position` | Enum | `top` | `top` \| `bottom` \| `left` \| `right`. |
| `title.align` | Enum | `center` | `start` \| `center` \| `end`. |
| `title.color` | Hex ohne `#` | `1A1A1A` | |
| `legend.display` | Boolean | `true` | |
| `legend.position` / `.align` | Enums | `top` / `center` | Gleiches Vokabular wie `title.*`. |
| `tooltip.enabled` | Boolean | `true` | |
| `scales.x.begin_at_zero` / `scales.y.begin_at_zero` | Boolean | `false` / `true` | |
| `scales.{x,y}.grid_display` | Boolean | `true` | |
| `scales.{x,y}.grid_color` | CSS-Farbe | `rgba(0,0,0,0.08)` | Akzeptiert Hex oder `rgba(…)`. |
| `scales.{x,y}.tick_color` | Hex ohne `#` | `888888` | |
| `scales.y.trim_to_data` | Boolean | `false` | Nur nicht gestapelte `bar`-Diagramme: die Y-Achse beginnt am nächsten runden Teilstrich unterhalb des kleinsten dargestellten Werts statt bei 0 (z. B. Schrittweite 5 und Minimum 132 → Achsenstart bei 130). Die Schrittweite wird automatisch als "runde" 1/2/5×10ⁿ-Zahl berechnet und über `ticks.stepSize` erzwungen, damit jeder Teilstrich auf demselben Raster liegt. Ohne Effekt bei gestapelten Balken, `line`/`pie`/`doughnut`/`pyramid`/`distance` sowie wenn der kleinste Wert `<= 0` ist. |
| `elements.line.tension` | Zahl 0–1 | `0.0` | `0` = gerade; `~0.4` = weiche Kurven. |
| `elements.line.point_radius` | px | `3` | |
| `elements.bar.border_radius` | px | `0` | Abgerundete Balkenecken. |
| `elements.bar.bar_percentage` | Zahl 0–1 | `0.9` | Anteil des Kategorieabschnitts, den die Balken einnehmen. |
| `elements.bar.max_columns` | Ganzzahl | – (aus) | Höchstzahl an Kategorien, die ein `bar`-Diagramm als senkrechte Säulen zeigt. Bei mehr Kategorien wird es zu waagerechten Balken (Kategorien auf der Y-Achse) und wächst in der Höhe: das Seitenverhältnis wird mit `max_columns / Kategorien` skaliert, sodass jeder Balken so dick bleibt wie bei genau `max_columns`. Gilt auch für gestapelte Balken; ohne Effekt bei anderen Diagrammtypen. Im DOCX wird ein zu hohes Diagramm auf die Seitenhöhe begrenzt. |

---

<a id="de-recipes"></a>

## Rezepte

### Eine Beschriftung in beiden Sprachen angeben

```yaml
parameters:
  office:
    label:
      de: "Schule"
      en: "School"
    type: text
    default: "Ministerium"
```

Das Formular zeigt „Schule" bei deutscher und „School" bei englischer Oberfläche. Eine in beiden Sprachen gleiche Beschriftung kann ein einfacher String bleiben.

### Ein Konfigurationsfeld als nutzerüberschreibbaren Parameter ausspielen

Einen `parameters:`-Eintrag hinzufügen, dessen `bind:` auf den Punktpfad zeigt:

```yaml
parameters:
  body_font_size:
    label:
      de: "Schriftgröße des Texts (pt)"
      en: "Body font size (pt)"
    type: number
    bind: export.font.size      # kein `default:` — Vorgabe liegt im gebundenen Blatt

export:
  font:
    size: 11                    # dies ist die Vorbelegung des Formulars
```

Der Wert des Nutzers wird zur Laufzeit nach `export.font.size` zurückgeschrieben; der Rest der Pipeline sieht die Überschreibung.

### Eine neue gebündelte Vorlage hinzufügen

1. Eine `.md`-Datei in [templates/](templates/) ablegen (z. B. `templates/quarterly.md`).
2. Einen neuen Eintrag unter `template.files:` ergänzen:

   ```yaml
   template:
     files:
       - label: "Standardbericht"
         file: report_template.md
       - label:
           de: "Quartalsübersicht"
           en: "Quarterly Snapshot"
         file: quarterly.md
   ```

3. `npm run dev` neu starten (Vite erfasst neue Vorlagendateien nur beim Start des Dev-Servers).

### Alle Abschnitte dezimal nummerieren mit Inhaltsverzeichnis

```yaml
export:
  section_numbering: true
  toc: true
```

Bei `toc: true` fragt Word beim ersten Öffnen **„Dieses Dokument enthält Verweise auf andere Dateien. Möchten Sie diese aktualisieren?"** — ein Klick auf *Ja* erzeugt die Verzeichniseinträge. Das ist Standardverhalten des `docx`-Pakets.

### Maskierung kleinster Gruppen zur Pro-Bericht-Entscheidung machen

In der ausgelieferten Konfiguration bereits gebunden:

```yaml
parameters:
  smallest_group:
    label:
      de: "Schwellenwert kleinste Gruppe"
      en: "Smallest group threshold"
    type: number
    bind: dataParameters.smallestGroup

data_parameters:
  smallest_group: 5
```

Das Zahlenfeld erscheint in Schritt 4; der Nutzer kann es für strengere Maskierung erhöhen oder (bis auf 1, womit die Maskierung deaktiviert wird) senken, wenn er mit nicht sensiblen Daten arbeitet.

### Querformat erzwingen, ohne es dem Nutzer anzubieten

Den `page_orientation`-Parametereintrag entfernen, aber die Vorgabe behalten:

```yaml
export:
  page:
    orientation: landscape
```

Der Exporter tauscht Breite/Höhe von A4 anhand von `orientation` automatisch, sodass Ränder/Seitenzahlen weiterhin korrekt umbrechen.

---

<a id="de-cross-references"></a>

## Querverweise

- [README.md](README.md) — nutzerorientierte Zusammenfassung
- [src/modules/i18n/](src/modules/i18n/index.ts) — Übersetzungsschicht; Standardsprache und Beschriftungsauflösung
- [src/modules/config/](src/modules/config/index.ts) — Konfigurationsparser; das Schema entspricht exakt dem, was dort eingelesen wird
- [src/modules/parameters/](src/modules/parameters/index.ts) — Formularaufbau, `bind:`-Auflösung
- [src/modules/exporter/](src/modules/exporter/index.ts) — Verbraucher von `export.*`
- [src/modules/renderer/chart.ts](src/modules/renderer/chart.ts) — Verbraucher von `charts.*`

<sub>[↑ Zum Seitenanfang](#reportix--configyaml-handbuch--handbook) · [Zur englischen Fassung ↑](#-english)</sub>

---

<a id="-english"></a>

# 🇬🇧 English

<sub>[Jump to the German version ↓](#-deutsch)</sub>

`config.yaml` tells the app **what to ask the user, where to find the data, which templates to ship, and how to style the output**. The configuration lives at the repo root: `config.yaml` is a thin manifest with an `include:` list of the per-section files under `config/`. Each section file holds one top-level section (`parameters:`, `data:`, etc.) — `data.yaml` additionally carries the closely-related `preprocessing:` section; the config module loads them at build time via Vite's `import.meta.glob('/config/*.yaml', { query: '?raw' })`, parses them, and shallow-merges them (the top-level sections are disjoint, so order only documents intent). The files are **not uploaded by end users** — only developers edit them.

This section is the authoritative reference for every key. Each subsection opens with a minimal YAML snippet, then enumerates every field.

## Contents (English)

- [Top-level layout](#en-top-level-layout)
- [`parameters:`](#en-parameters)
  - [Localized labels (`label:`)](#en-localized-labels)
  - [Standalone vs. bound parameters](#en-standalone-vs-bound)
  - [Parameter types](#en-parameter-types)
  - [Special parameter keys (`palette`, `font`, `page_orientation`, `page_numbers`)](#en-special-keys)
- [`data:`](#en-data)
- [`preprocessing:`](#en-preprocessing)
- [`template:`](#en-template)
  - [Question catalog (`template.questions`)](#en-template-questions)
- [`data_parameters:`](#en-data-protection)
- [`export:`](#en-export)
- [`charts:`](#en-charts)
- [Recipes](#en-recipes)
- [Cross-references](#en-cross-references)

---

<a id="en-top-level-layout"></a>

## Top-level layout

```yaml
parameters:        # form fields shown before report generation
data:              # expected sheets/columns in uploaded .xlsx files
preprocessing:     # derived datasets (joins) built before rendering
template:          # bundled Markdown templates the user can pick from
data_parameters:   # reporting period + masking threshold for aggregated counts
export:            # DOCX styling and metadata
charts:            # global chart rendering defaults
```

All sections are optional except `parameters:`, `data:`, and `template:`, but in practice you'll want `export:` and `charts:` for any non-trivial report.

---

<a id="en-parameters"></a>

## `parameters:`

The `parameters` section drives the form rendered in Step 4 ("Report Parameters"). Each entry is one form field.

```yaml
parameters:
  title:
    label: "Title"            # plain string — same in every language
    type: text
    default: "Report"
  office:
    label:                    # or a per-locale map (see below)
      de: "Schule"
      en: "School"
    type: text
    default: "Ministry"
  font_size:
    label: "Body font size (pt)"
    type: number
    bind: export.font.size
```

A parameter may additionally carry `definition:` (German only) or `info:` (bilingual) — the text appears as a clickable ⓘ tooltip next to the label (see [Tooltips](#en-tooltips)).

**Which step asks for it — `step:`.** By default every parameter appears in step 4 ("Report Parameters"), alongside the layout settings. `step: template` moves the field to **step 1**, beside the template chooser — meant for facts that describe the report itself and are better answered up front, such as the reporting period:

```yaml
  period_start:
    label:
      de: "Berichtszeitraum von"
      en: "Reporting period from"
    type: date
    step: template            # step 1 instead of step 4
    bind: dataParameters.periodStart
```

| Value | Effect |
|---|---|
| `parameters` (default) | Step 4, "Report Parameters" |
| `template` | Step 1, "Choose Period and Template" |
| `data` | Step 3, "Data Validation" — a checklist built from the uploaded values (see below) |

Step 1 renders these as its own row (`buildInlineFields`) rather than through step 4's parameter form: that form ends in a "generate report" submit button, which is the wrong action for step 1 — it continues with its own Continue button — and stacks its fields vertically, where a from/to pair belongs side by side. Labels and ⓘ tooltips behave identically. Step 1's and step 3's values are merged with step 4's when the preview is generated.

**Checklists from the data — `step: data`, `options_from`, `default_when`.** Some decisions depend on which values actually occur in the uploaded file — such as which profiles count as STEM. A `multiselect` with `step: data` therefore appears in step **3, "Data Validation"**, as a checklist: `options_from` names a dataset and column, and its distinct non-empty values are offered (with row counts, naturally sorted: `Q9` before `Q10`). Every value matching `default_when` — the same operators as a mutation's `when:` — starts ticked. The selection is fixed **before** preprocessing runs; a mutation reads it through `from_config` (see [`mutations`](#en-preprocessing)). Every checklist change recomputes preprocessing and the warnings immediately.

```yaml
  mint_profiles:
    label: { de: "Ausbildungsrichtungen des MINT-Zweigs", en: "Profiles counting as STEM" }
    type: multiselect
    step: data
    options_from: { dataset: Schueler, column: Ausbildungsrichtung }
    default_when: { contains: [Naturwissenschaft, Technik, technolog] }
    bind: dataParameters.selections.mint_profiles
```

| Field | Type | Notes |
|---|---|---|
| `options_from` | `{ dataset, column }` | Source of the options, read from the **uploaded** data before preprocessing. If the dataset is missing or the column holds no values, the checklist is omitted. |
| `default_when` | condition | Pre-selection. Omit → nothing pre-selected. |
| `bind` | path | Conventionally `dataParameters.selections.<name>` (see [`data_parameters:`](#en-data-protection)). |

When the mapping in step 2 is changed and confirmed again, step 3 is rebuilt: values offered before keep their tick, new values follow `default_when`. Steps 4 and 5 close until Continue is pressed again.

<a id="en-localized-labels"></a>

### Localized labels (`label:`)

The UI ships in **German (default)** and **English**, switchable via the language selector at the top of the app (currently hidden — the app runs German-only for now; English labels remain valid). So every `label:` may be written in **two forms**:

- **A plain string** — used verbatim in every language:

  ```yaml
  title:
    label: "Title"
  ```

- **A per-locale map** — one entry per language; the app picks the entry matching the active UI language:

  ```yaml
  title:
    label:
      de: "Titel"
      en: "Title"
  ```

**Where it applies.** Anywhere a `label:` appears — both `parameters.<key>.label` and `template.files[].label`.

**Resolution order.** active locale → default locale (`de`) → the first entry provided → the parameter key (as a last-resort fallback). So a map that is missing the current language still renders something sensible, and a label that is identical in both languages can stay a plain string.

**When the language switches**, the config is re-parsed and every label re-resolves — so the form re-renders in the chosen language with no reload.

**Not translated:** option *values* (the `options:` list) are data/IDs (e.g. `okabe-ito`, `portrait`), not display text, and are used as-is in every language.

> The language layer (`src/modules/i18n/`) localizes all program text too — buttons, step headings, validation warnings, error messages, and chart alt text. Config labels are the developer-authored part of that surface.

### Standalone vs. bound parameters

A parameter is either **standalone** (a template variable, prefilled from `default:`) or **bound** to a leaf elsewhere in `config.yaml` via `bind:`.

| | Standalone | Bound |
|---|---|---|
| Has `default:` | Yes — the preset | No — the preset is the bound leaf |
| Has `bind:` | No | Yes (dotted path, e.g. `export.font.size`) |
| Used by | Template substitution (`{{title}}`) | Renderers / exporter (after the bound leaf is overridden) |

<a id="en-standalone-vs-bound"></a>

**Resolution rule.** At runtime, every bound parameter's user-entered value is written back to its `bind:` path before the renderers and exporter see the config. Standalone parameters stay in the parameter map and are interpolated into the Markdown template as `{{key}}`.

**Why use `bind:`?** It lets you expose any config leaf as a per-report user toggle without duplicating the value or hand-wiring the override. For example, by binding `font_size` to `export.font.size`, the developer controls the default in the config and the user can override per report.

> **Important — `bind:` paths target the parsed `AppConfig` (camelCase), not the raw YAML keys.** Most leaves are spelled the same in both (`export.font.size`, `export.page.orientation`), but multi-word keys differ: bind to `export.pageNumbers.position`, `export.sectionNumbering`, `dataParameters.smallestGroup` — **not** the snake_case `export.page_numbers.show` etc. A `bind:` to a non-existent path **silently no-ops** (the override never reaches the consumer). The parser maps snake_case YAML → camelCase (see [src/modules/config/](src/modules/config/index.ts)).

<a id="en-parameter-types"></a>

### Parameter types

| `type:` | Renders as | Collected value |
|---|---|---|
| `text` | text input | string |
| `number` | number input | number |
| `date` | date picker | ISO date string |
| `select` | dropdown (or radio for `palette`/`font`) | string |
| `multiselect` | multi-select listbox | `string[]` |
| `boolean` | checkbox | boolean |
| `color` | native color picker (`<input type="color">`) | hex string with `#` (`#rrggbb`) |

`select` and `multiselect` require an `options:` list:

```yaml
page_orientation:
  label:
    de: "Seitenausrichtung"
    en: "Page orientation"
  type: select
  bind: export.page.orientation
  options: [portrait, landscape]   # values are not translated
```

<a id="en-special-keys"></a>

### Special parameter keys (`palette`, `font`, `page_orientation`, `page_numbers`)

Four parameter keys get bespoke UI widgets:

- **`palette`** — radio group; each option shows the palette name plus a horizontal strip of its actual colour swatches. Bound to `charts.palette`. Options must match palette IDs registered in [src/modules/palettes/](src/modules/palettes/index.ts) (`okabe-ito`, `tol-bright`, `tol-muted`, `ibm`, `grayscale`). Colors stacked bar chart segments (one hue per row) and, as a fallback, any non-gender category in other chart types.
- **`font`** — radio group; each option label is rendered in the actual typeface. Bound to nothing (curated theme — maps a font ID to a CSS stack, DOCX family, and display name via [src/modules/fonts/](src/modules/fonts/index.ts)). Options must match font IDs (`verdana`, `tahoma`, `arial`, `georgia`).
- **`page_orientation`** — icon radios showing page-shape symbols (portrait/landscape) instead of text. Bound to `export.page.orientation`. Options: `portrait`, `landscape`. Values are translation-free; captions come from the i18n module.
- **`page_numbers`** — icon radios showing page symbols for the page-number position. Bound to `export.pageNumbers.position`. Options: `left`, `center`, `right`, `none` (`none` hides the page number).

All keys still follow the standard schema (including localized `label:`); only their UI rendering is special.

There are also two color-picker parameters (`type: color`): `gender_color_male` / `gender_color_female`, bound to `charts.gender.male` / `charts.gender.female`. Since every crosstab in this config is broken down by "Geschlecht", these two colors drive coloring in every chart type **except** stacked bar charts, which use `palette` instead (a stack can have more segments than there are gender colors to spare) — see [`charts:`](#en-charts).

---

<a id="en-data"></a>

## `data:`

Declares the data sources the app expects the user to upload, each with one or more sheets and their columns. These names are **mapping targets**: the user first picks a format (XLSX or CSV) and then maps their file's actual sheets/columns onto these names (pre-selected by matching name). It is **no longer a rigid validation** — the declared names need not appear verbatim in the file.

```yaml
data:
  Dataset:
    sheets:
      - sheet: Sheet 1
        definition: "What this sheet is about."     # optional
        notes: "Further notes."                     # optional
        include: [full]                             # optional; omit ⇒ every template
        columns:
          - Col 1                                    # short form: just the name
          - column: Col 2                            # long form with metadata
            definition: "Column definition."          # optional
            notes: "Further notes."                   # optional
            include: [full, mandatory]                # optional; omit ⇒ every template
      - sheet: Sheet 2
        columns: [Col A, Col B]
```

| Field | Type | Notes |
|---|---|---|
| `<source name>` | object | Top-level key is the source identifier shown in the upload UI. |
| `.sheets[].sheet` | string | Excel sheet name as it appears in the workbook. |
| `.sheets[].definition` | string | Optional. Definition of the sheet (German only), shown as a tooltip — see [Tooltips](#en-tooltips). `description:` is still accepted as a legacy alias. |
| `.sheets[].info` | string \| per-locale map | Optional. Bilingual tooltip text; takes precedence over `definition`. |
| `.sheets[].notes` | string | Optional. Further notes about the sheet (metadata) — e.g. concept definitions that don't map to a single column. |
| `.sheets[].include` | `string[]` | Optional. List of template `id`s (see [`template:`](#en-template)) for which this sheet is requested in the data step. **Omit ⇒ every template.** |
| `.sheets[].columns` | list of string **or** object | Required column headers (compared after Unicode NFC + whitespace normalisation). A column may be a plain string, or an object with `column:` (alias `name:`) plus optional `definition:`, `info:`, `notes:`, `include:` (same semantics as at sheet level). |

**Mapping, not validation.** In the data step the user picks **XLSX** (one workbook per source; each config sheet → a workbook sheet) or **CSV** (one single-table file per sheet; also accepts a single-sheet `.xlsx`) and maps each sheet/column via a dropdown. The option whose name matches is pre-selected. Unmapped sheets/columns produce **non-blocking warnings** on Continue (shown in the selected UI language); the pipeline proceeds and blocks referencing missing data render as a red "TBD" note. Mapped columns are **renamed** to the config column names.

**DataStore keying.** Internally each loaded sheet is stored under its sheet name. Chart and table blocks reference data via this key — e.g. `data: Sheet 1` in a chart block looks up `DataStore["Sheet 1"]`.

**Template-scoped data step.** The data step only asks for the data the selected template actually uses — in two passes: first the manual `include:` filter (sheets/columns whose `include` contains the template's `id`, or that have no `include`), then the app automatically computes the **required columns** from the template's chart/table blocks (`groupby.rows`/`cols`, `value`, real `filter` columns) and resolves them through the preprocessing pipeline back to physical columns: derived columns require their `from` source column, join-supplied columns require the right sheet plus the join keys on both sides. Unneeded sheets/columns are never requested and produce no warnings.

**Note on the `Zeitraum_*` sheets.** Columns that duplicated master data were deliberately removed from the `Zeitraum_*` event sheets — they are supplied at runtime by joining with `Schueler` (key `SchuelerID`; see [`preprocessing:`](#en-preprocessing)). Exception: `Zeitraum_Anmeldung` has its own key (`AnmeldeID`) and is not joined with `Schueler`, so it keeps its attributes directly.

<a id="en-tooltips"></a>

**Tooltips (`definition` / `info`).** Templates, sheets, columns, and parameters can carry explanatory tooltip text. In the app a clickable **ⓘ** icon appears next to them and shows the text as a small popup (click outside or Esc to close). Two fields:
- `definition` — **German only** (plain string). Same text in every language.
- `info` — **bilingual** (`{ de, en }` or a plain string), bound to the active language at build time like `label`.

When both are present, `info` wins. When neither is present, no ⓘ is shown. Mutations (derived columns, see [`preprocessing:`](#en-preprocessing)) also accept `definition`. The three step tooltips (template, data, parameters) come from the i18n module.

---

<a id="en-preprocessing"></a>

## `preprocessing:`

Optional derived columns and datasets built **between data load and rendering** from the loaded sheets. Two operations: **`mutations`** (derived columns) run first, then **`joins`**. Results are stored in the DataStore and can be referenced in templates like normal sheets (`data: <name>`).

> This section lives in the same file as [`data:`](#en-data) (`config/data.yaml`), since mutations and joins operate directly on the sheets defined there.

### `mutations` — derived columns (if-else)

A mutation adds a column to a dataset with a **simple if-else rule**: where the condition holds for the `from` value, the new `column` gets `then`, otherwise `else` (default `""`). This is how the bundled school report derives the `Oberstufe` column from `Jahrgangsstufe`, and event flags such as `Wiederholung` from the `Ergebnis` of a promotion decision.

```yaml
preprocessing:
  mutations:
    - dataset: Schueler                          # dataset that receives the column
      column: Oberstufe                          # new (or overwritten) column
      definition: "Civil-servant vs. collective-agreement status …"  # optional (metadata)
      from: Jahrgangsstufe                       # source column the condition tests
      when: { gte: 11 }                          # condition (omit → "value is truthy")
      then: "Ja"
      else: "Nein"                               # optional (default "")
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `dataset` | string | — | Dataset the column is added to (as a derived copy). |
| `column` | string | — | Name of the new (or overwritten) column. |
| `definition` | string | — | Optional. Definition of the derived column (metadata), mirroring `.sheets[].columns[].definition`. |
| `from` | string or list | — | Source column(s). The if-else form tests the (first) column; an `fn` mutation receives every listed column, in that order. |
| `when` | object | truthy | Condition on `from` (see operators). Omit → "value is truthy". |
| `then` | any | — | Value written when the condition holds. |
| `else` | any | `""` | Value written otherwise. |
| `fn` | string | — | Name of a transform function (see below). When set, the function computes the column and `when`/`cases`/`else` are ignored. |
| `options` | object | `{}` | Passed to the `fn` function verbatim. |

**Condition operators** (inside `when`, combined with AND; scalar operators also accept a list = "any of"): `equals`, `not_equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches` (regex), `gt`/`gte`/`lt`/`lte` (numeric), `empty` (bool), `truthy` (bool — `true`/`Ja`/`Yes`/`1`). String comparisons are NFC-normalized and trimmed.

**Value lists from the config.** Instead of a literal list, `equals`, `in`, `not_equals`, `contains`, `starts_with` or `ends_with` may hold a reference `{ from_config: <path> }` — this is how a mutation reads the selection of a [step-3 checklist](#en-parameters): `when: { in: { from_config: dataParameters.selections.mint_profiles } }`. It resolves against the config *after* the user's answers are merged in; an unresolvable path becomes an empty list, which matches nothing. (In `validation:` rules such a reference is not resolved and likewise matches nothing.)

### `fn` — computed columns via a transform function

Some derivations cannot be written as if-else — date arithmetic, running totals, lookup tables. Rather than growing the app's operator set for each of them, `fn:` names a **TypeScript function that lives beside the config**: every named export from `config/functions/*.ts` is registered automatically at build time. This keeps the `src/` tree free of project-specific domain logic — a new derivation means adding a function here and naming it in the YAML.

```yaml
preprocessing:
  mutations:
    - dataset: Zeitraum_Beurlaubung
      column: "Beurlaubungsdauer"
      definition: "Days of leave within the reporting period."
      fn: date_difference                        # named export from config/functions/*.ts
      from: [Beurlaubungsende, Beurlaubungsbeginn]  # columns, in this order
      options:                                   # handed to the function verbatim
        inclusive: true
        min: 0
```

A transform is **column-wise, not row-wise**: it receives one array per `from` column (aligned by row index) and returns the finished column as an array.

```ts
// config/functions/dates.ts
import type { ColumnTransform } from "../../src/modules/transforms";

export const date_difference: ColumnTransform = (columns, ctx) => {
  const [end, start] = columns;            // columns[i] = the column from from[i]
  return Array.from({ length: ctx.rowCount }, (_, r) => /* … */ 0);
};
```

`ctx` carries `rowCount` (the required length of the returned array), `options`, `dataset` and `column`. Nothing is evaluated from a string — there is no `eval`/`new Function`, so the strict CSP is unaffected.

Failures never block; they surface as a warning and the column is **not** created (unlike the if-else form, which falls back to `else`):

| Situation | Behaviour |
|---|---|
| `fn` not registered | Warning; column absent. |
| A `from` column is missing from the dataset | Warning; column absent (the function is not run on `undefined` values). |
| The function throws | Warning with the error message; column absent. |
| The result is not an array, or has the wrong length | Warning; column absent. |
| The same name in two files | Warning; the last export loaded wins. |

`requiredDataForBlocks` resolves **every** `from` column, so the mapping UI requests each source column the transform needs.

### `joins`

Enrich rows in one sheet with columns looked up from another by a shared key. The result is stored under `name`; `name` = `left` enriches the source in place.

```yaml
preprocessing:
  joins:
    - name: Zeitraum_Vorrueckung    # output dataset (= left → enrich in place)
      left: Zeitraum_Vorrueckung    # base; one output row per left row (left join)
      right: Schueler               # looked-up sheet
      on: SchuelerID                # shared key (or left_on / right_on)
      type: left                    # left (keep unmatched) | inner (drop)
      # omit select → copy every right column not already on the left
      # select: [Stufe, {column: Klasse, as: Klassenbezeichnung}]   # explicit
      # prefix: "ST_"               # prepended to copied column names
      # indicator: "matched"        # bool column: did the left row match?
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `name` | string | — | Output dataset name (referenced by `data:` blocks). `name` = `left` enriches the source in place. |
| `left` | string | — | Base dataset; one output row per left row (for `left`). |
| `right` | string | — | Dataset to look values up in. |
| `on` | string | — | Key present in both sheets (shorthand for equal `left_on`/`right_on`). |
| `left_on` / `right_on` | string | — | Keys with different names on each side. |
| `type` | enum | `left` | `left` (keep unmatched left rows) \| `inner` (drop them). |
| `select` | list | all | Right columns to copy. Omit → every column that isn't the key and isn't already on the left. Entry: column name or `{ column, as }` (rename). |
| `prefix` | string | `""` | Prepended to every copied column name (collision safety). |
| `indicator` | string | — | Optional boolean column: did the left row match any right row? |

**Semantics.**
- **First-match lookup**, not a SQL cross-product — a left row appears at most once even if several right rows share its key (keeps counts/shares stable).
- `type: left` keeps unmatched left rows (copied columns blank, `indicator` false); `type: inner` drops them.
- `select` omitted → enrichment: every right column except the key and any already present on the left. Explicit `select` validates each name against the right schema (missing → warning, skipped).
- Joins run **in order, after all mutations**; a later join may reference an earlier join's output, and joins carry mutation-derived columns along.
- Keys are matched after NFC + whitespace normalization.

**Why the school report needs both.** The `Zeitraum_*` event sheets (e.g. `Zeitraum_Vorrueckung`) carry only event data. Mutations derive `Stufe` (from `Jahrgangsstufe`) on `Schueler` and the `Vorgerückt` / `Wiederholung` flags (from `Ergebnis`) on the event sheet; the `Schueler → Zeitraum_Vorrueckung` join then carries the Stufe onto each decision by `SchuelerID`. Together they supply every column the promotion charts reference in their `groupby:`, `filter:` and `value:`.

Structural problems (missing sheet, missing key, missing column, no matches) surface as **non-blocking warnings** in the same yellow banner as data validation — the build never aborts.

---

<a id="en-template"></a>

## `template:`

Lists the bundled Markdown templates the user picks from in Step 2.

```yaml
template:
  files:
    - id: full                        # optional, translation-free identifier
      label: "Standard Report"        # plain string, or a per-locale map:
      file: report_template.md
    - id: summary
      label:
        de: "Kurzfassung"
        en: "Quick Summary"
      file: summary_template.md
```

| Field | Type | Notes |
|---|---|---|
| `files[].id` | string | Optional. Stable, translation-free identifier referenced by the `include:` lists in the [`data:`](#en-data) section. When this template is selected, the data step shows only the sheets/columns whose `include` contains this `id` (or that have no `include`). |
| `files[].label` | string \| per-locale map | Human-readable name shown in the radio chooser. Localizable like any `label:` — see [Localized labels](#en-localized-labels). |
| `files[].definition` | string | Optional. German tooltip text for the template — see [Tooltips](#en-tooltips). |
| `files[].info` | string \| per-locale map | Optional. Bilingual tooltip text; takes precedence over `definition`. |
| `files[].file` | string | Filename inside the bundled `templates/` directory (no path). |

**Bundling.** Every `.md` file under `/templates/` is included in the JS bundle at build time via `import.meta.glob`. There is no runtime fetch (the CSP forbids `connect-src`), so the file must exist at build time.

**Generated, not hand-edited.** The files under `templates/` are **build artifacts** (git-ignored). They are assembled by `scripts/gen-templates.ts` (`npm run gen:templates`, wired as a `predev`/`prebuild`/`pretest` hook) from two sources: the prose skeleton `templates/master.md` (with the generation-time placeholders `{{questions}}` and `{{tables}}`) and the [question catalog](#en-template-questions) `template.questions`. For every entry with an `id` **and** `file`, the assembled template is written to `templates/<file>`. Prose can still be scoped to individual templates with section markers (`<!-- include: <id> -->` … `<!-- /include -->`; unmarked content goes into every template). Edit `templates/master.md` and `config/template.yaml`, not the generated files.

**Hard-fail behavior.** If any `file:` referenced here isn't present in the bundle, the app throws at startup listing what's missing and what's available. This catches typos and forgotten files early.

**Minimum: one entry.** An empty `files:` list also hard-fails.

<a id="en-template-questions"></a>

### Question catalog (`template.questions`)

A flat, **ordered** list read only by the generator — the runtime config parser ignores the key. It is rendered into the master's `{{questions}}` placeholder; `{{tables}}` (in the Anhang → Tabellen appendix) receives one `table` block per question with the same spec and the same `caption`, grouped under the same sections as the Situationsbeschreibung (one level deeper, without Definitionen/Fazit). Two entry types, discriminated by their first key:

```yaml
template:
  questions:
    - section: Förderung                # "### …" heading + Definitionen callout;
      definitions:                      # a Fazit callout is appended automatically
                                        #   after the section's last question.
        # Entries reference the definition: texts in data.yaml (columns,
        # derived columns, sheets — a single source of truth for the wording):
        - Förderart
        - term: Bewilligt               # displayed term ≠ data.yaml name
          ref: "Fördermaßnahme bewilligt"
        - term: Förderbedarf            # concept without a data.yaml entry → inline text
          text: "Gibt an, ob …"

    - title: "Wie viele Fördermaßnahmen wurden bewilligt?"
      include: full                     # template id(s); omit ⇒ every template
      comment: Optional                 # italic status line under the heading
      datenquelle: "Förderkoordination, Eigene Liste"
      personenkreis: Alle
      caption: "Anzahl der bewilligten Fördermaßnahmen nach Geschlecht."
      text:                             # omit ⇒ default freetext placeholder
      table:                            # shared crosstab spec
        data: Zeitraum_Foerdermassnahme
        filter: Alle                    # optional truthy-column row filter
        groupby:
          rows: Geschlecht              # column name, a list [a, b] (bucket by the tuple), or omit ⇒ single "Total" row
          # cols: Geschlecht            # optional: table columns / chart series
        aggregation: count              # default: count
        # value: <column>               # required by sum/mean/min/max/median/share_group
        # format: currency              # optional cell format (integer|decimal|percent|currency)
      chart:                            # presentation only
        type: bar                       # bar | line | pie | doughnut | pyramid | distance
        # stacked: true                 # bar/line: stack the series
        title: Personen mit LK nach Geschlecht
```

| Field | Type | Notes |
|---|---|---|
| `section` | string | Section entry: emits `### <section>` in the document and `#### <section>` in the table appendix; sections with no included question are skipped entirely. |
| `definitions` | list | Entries of the `Definitionen` callout, rendered as `**term**: text`. A plain string looks itself up in data.yaml (columns in document order, then derived columns from `preprocessing.mutations`, then sheets by sheet name); `{term, ref}` displays `term` but resolves `ref`; `{term, text}` is emitted verbatim. A dangling `ref` fails the generation — the wording therefore lives exclusively in data.yaml's `definition:` fields. |
| `title` | string | Question entry: emits `#### <title>` in the document and `##### <title>` in the table appendix. |
| `include` | string \| list | Template id(s) from `template.files[].id`; omit ⇒ every template. |
| `comment` | string | Italic status line (e.g. `Optional`, `Verpflichtend für …`). |
| `datenquelle`, `personenkreis` | string | Source line `> Datenquelle: … · Personenkreis: … · Datensatz: <table.data>`. |
| `caption` | string | Figure caption of the chart **and** caption of the appendix table. |
| `text` | string | Freetext paragraph; omit ⇒ default placeholder. |
| `table` | object | Crosstab spec (`data`, `filter`, `groupby.rows`/`cols`, `aggregation`, `value`, `format`) — identical to the template `table` block format, see README.md → Template Format. |
| `chart` | object | Presentation keys: `type`, `stacked`, `title`, `alt`, `alt-intro`, `caption` (overrides the question `caption`). |

The generator validates the catalog (exactly one of `section`/`title`; `table.data` required; `table.groupby.rows` must be a column name or a non-empty list of them; value ops require `value:`; `include` ids checked against `template.files[].id`) and aborts on structural errors.

---

<a id="en-data-protection"></a>

## `data_parameters:`

Facts about the **dataset** — which period it covers, and the group size below which values are masked. Both are questions the user answers about their data rather than about layout or export, which is why they sit together. The section lives in `config/data.yaml`, beside the sheets it describes.

> **Renamed.** This section used to be `data_protection:` and held only `smallest_group`. The old name is still read (`data_parameters:` wins if both appear) but should no longer be used.

```yaml
data_parameters:
  smallest_group: 5                          # bound by parameters.smallest_group
  period_start: last_year_start   # a token, not a literal — it never ages
  period_end: last_year_end       # bound by parameters.period_end
  category_order:                 # optional: fixed value order per column
    Geschlecht: [männlich, weiblich]
    Arbeitszeitanteil: ["40", "50", "60", "70", "80", "90", "100"]
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `smallest_group` | number | `5` | Aggregated values strictly below this and greater than zero are masked. |
| `period_start` | date or token | — | First day of the reporting period. |
| `period_end` | date or token | — | Last day of the reporting period. |
| `category_order` | map: column → value list | — | Fixed display order for a column's values (see below). |
| `selections` | map: name → value list | — | Target of the step-3 checklists (`step: data`, bound to `dataParameters.selections.<name>`). Not meant to be pre-filled in YAML — the pre-selection comes from `default_when`. |

**`category_order`** fixes a named column's value order — an "ordered factor" — wherever that column drives a crosstab axis. Without it, `wrangleTable` sorts rows naturally — text alphabetically, embedded numbers by value (`E8` before `E9` before `E10`, `"40"` before `"100"`) — and cols in first-seen order; that's wrong when the order is a matter of meaning (e.g. `männlich` before `weiblich` as columns, whichever value appears first in the data). `category_order` applies to `groupby.cols` always, and to `groupby.rows` when it names a single column (a list of several columns — composite rows — keeps the default natural order, since an order over value tuples isn't well-defined). Values are matched NFC-normalized and trimmed (not case-folded); any value present in the data but missing from the list sorts naturally after the listed ones, so the list doesn't need to be exhaustive.

**Relative date tokens.** A literal date in the config ages — the default would need editing by hand every January. So instead of `"2025-01-01"` the field accepts a token, resolved against the current date when the config is parsed:

| Token | Resolves to |
|---|---|
| `last_year_start` / `last_year_end` | 1 January / 31 December of the previous year |
| `this_year_start` / `this_year_end` | 1 January / 31 December of the current year |
| `today` | today's date |

Anything else passes through untouched, so explicit `YYYY-MM-DD` dates keep working. The same tokens are accepted for a `date_difference` mutation's `clamp_start` / `clamp_end`.

**The period during preprocessing.** Where a computation needs the period — trimming the leave duration, for instance — the mutation points at it with `from_config:`, a path into the **resolved** config:

```yaml
      fn: date_difference
      from: [Beurlaubungsende, Beurlaubungsbeginn]
      options:
        clamp_start: { from_config: dataParameters.periodStart }
        clamp_end: { from_config: dataParameters.periodEnd }
```

"Resolved" means *after* the user's answers are merged in. The period is asked in step 1 (`step: template`) and preprocessing runs in step 3, "Data Validation", so the user's input genuinely reaches the computation — not just the default in this file. Narrowing the period in the form to half a year yields correspondingly trimmed durations.

`from_config:` works for any option and any config path; an unresolvable path yields `undefined` (the function decides what that means), and anything else passes through untouched.


**Where it applies.** To **every** aggregation, and by **group size** rather than by value: a cell is masked when it rests on at least one but fewer than `smallest_group` source rows. What identifies someone is how few people stand behind a number — for `count` that is the same as the value, but nowhere else: a mean of €4,200 over two people is identifying although its value is far above the threshold, while an average grade of 3.2 over ten people reveals nothing. Empty cells (0 rows) are never masked.

**How a masked cell is shown.** `<5` appears only where the displayed number **is** the group size, i.e. `count`. For mean, sum, median, min, max and the share ops that label would simply be untrue, so a neutral placeholder ("n/a") is shown:

- **Tables:** `<5` for `count`, the placeholder otherwise.
- **Charts:** a masked `count` is clamped to the threshold so a small bar is still drawn; every other op plots **nothing** (0) — there is no honest small stand-in for a suppressed mean, and a fabricated bar would be read as real. Tooltip and permanent value label show the same text as the table.
- **Alt texts:** the data-point listing gives `<5` or a spelled-out note, so screen-reader users get the same caveat sighted readers do.

---

<a id="en-export"></a>

## `export:`

DOCX styling and metadata. Every leaf here is a candidate for a `bind:` exposure in `parameters:`.

```yaml
export:
  filename: report.docx
  locale: de-DE
  section_numbering: false
  toc: false

  document:
    title: Report
    subject: ""
    creator: ""
    description: ""
    keywords: ""

  font:
    family: Arial
    size: 11
    heading_family: Arial
    color: "1A1A1A"

  headings:
    color: "1F3864"
    h1_size: 20
    h2_size: 16
    h3_size: 13
    h4_size: 12

  paragraph:
    alignment: left
    spacing_before: 0
    spacing_after: 120
    line_spacing: 276

  page:
    orientation: portrait
    width: 11906
    height: 16838
    margin:
      top: 1418
      right: 1418
      bottom: 1418
      left: 1418
      header: 709
      footer: 709

  page_numbers:
    position: center
    start: 1
    format: decimal

  header:
    text: ""

  footer:
    text: ""

  table:
    border_style: single
    border_color: "AAAAAA"
    border_size: 4
    cell_padding: 80

  definition_box:
    color: "1F77B4"
    background: true
  summary_box:
    color: "2CA02C"
    background: true
```

### Top-level

| Field | Type | Default | Notes |
|---|---|---|---|
| `filename` | string | `report.docx` | Output filename. |
| `locale` | string | `en-US` | BCP-47 locale used for number/currency formatting. (Independent of the UI language.) |
| `section_numbering` | boolean | `false` | Numbers section headings `<h2>`–`<h5>` as `1.`, `1.1.`, `1.1.1.`, `1.1.1.1.` (the appendix tables sit at `<h5>`; the TOC lists `<h2>`–`<h4>` only) — in the **preview** via CSS counters and in the **DOCX** via per-heading multilevel numbering. The title (`# {{title}}`, an `<h1>`) is treated as the document title and is not numbered. |
| `toc` | boolean | `false` | Inserts a table of contents **just before the first `<h2>`** (after the title/subtitle): a Word TOC field in the **DOCX** and a `<nav class="report-toc">` in the **preview**. The TOC heading is written in the active UI language. Word prompts to "update fields" the first time the document opens; entries materialise then. |

### `document.*` — DOCX metadata

Written into the .docx file properties (Title / Subject / Author / Description / Keywords).

### `font.*` — body text

| Field | Type | Default | Notes |
|---|---|---|---|
| `family` | string | `Arial` | Body font (overridden at runtime by the `font` parameter). |
| `size` | number (pt) | `11` | Body text size. |
| `heading_family` | string | inherits `family` | Optional override for heading typeface. |
| `color` | hex w/o `#` | `1A1A1A` | Body text colour. |

### `headings.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | hex w/o `#` | `1F3864` | Applied to all heading levels unless overridden. |
| `h1_size`–`h4_size` | number (pt) | `20`, `16`, `13`, `12` | Per-level sizes. |

### `paragraph.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `alignment` | enum | `left` | `left` \| `center` \| `right` \| `justify` |
| `spacing_before` | twips | `0` | Space before paragraph. |
| `spacing_after` | twips | `120` (≈6 pt) | Space after paragraph. |
| `line_spacing` | twips | `276` | `276` ≈ single at 11 pt; `360` ≈ 1.5×; `480` ≈ double. |

### `page.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `orientation` | enum | `portrait` | `portrait` \| `landscape`; auto-swaps A4 dimensions. |
| `width`, `height` | twips | A4 (11906 × 16838) | Override only if non-A4. |
| `margin.top` / `.right` / `.bottom` / `.left` | twips | `1418` (~25 mm) | |
| `margin.header` / `.footer` | twips | `709` (~12 mm) | Distance from page edge to header/footer content. |

> **Twips refresher.** 1 mm ≈ 56.7 twips. 1 inch = 1440 twips. 1 pt = 20 twips.

### `page_numbers.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `position` | enum | `center` | Footer page-number placement: `left` \| `center` \| `right` \| `none` (`none` hides it). The number is rendered plain (e.g. `1`), without a total. Legacy `show: false` still acts as `position: none`. |
| `start` | number | `1` | Starting page number. |
| `format` | enum | `decimal` | `decimal` \| `upperRoman` \| `lowerRoman` \| `upperLetter` \| `lowerLetter`. |

### `header.text`, `footer.text`

Static strings rendered in the page header (left-aligned) and footer (left of the page numbers).

### `table.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `border_style` | enum | `single` | `single` \| `double` \| `dashed` \| `dotted` \| `thick` \| `none`. |
| `border_color` | hex w/o `#` | `999999` | |
| `border_size` | eighths of pt | `4` | |
| `cell_padding` | twips | `80` (~1.5 mm) | |

### `definition_box.*` and `summary_box.*`

Style overrides for callout blocks. `definition_box` styles `::: {.callout-note} … :::`; `summary_box` styles `::: {.callout-tip} … :::`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | hex w/o `#` | `1F77B4` / `2CA02C` | Drives the left border and title colour. |
| `background` | boolean | `true` | When `true`, fills the cell with a pale tint derived from `color`; when `false`, no fill. |

---

<a id="en-charts"></a>

## `charts:`

Global Chart.js defaults applied to every chart in every template.

```yaml
charts:
  palette: okabe-ito
  animation: false
  aspect_ratio: 2.0
  max_height_ratio: 1.0

  gender:
    male: "#0072B2"
    female: "#CC79A7"

  font:
    family: Arial
    size: 12
    color: "555555"

  title:
    display: true
    position: top
    align: center
    color: "1A1A1A"

  legend:
    display: true
    position: top
    align: center

  tooltip:
    enabled: true

  scales:
    x:
      begin_at_zero: false
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"
    y:
      begin_at_zero: true
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"
      trim_to_data: false

  elements:
    line:
      tension: 0.0
      point_radius: 3
    bar:
      border_radius: 0
      bar_percentage: 0.9
      max_columns: 10
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `palette` | palette ID | `okabe-ito` | Colors stacked bar chart segments (one hue per row), and is the fallback color source for any non-gender category in other chart types. Bound by `parameters.palette` (radio group). |
| `gender.male` | hex with `#` | `#0072B2` | Color for any category value that normalizes (NFC + trim + lowercase) to "männlich" — on any axis (rows or cols), in every chart type **except stacked bar charts** (which use `palette` instead). Bound by `parameters.gender_color_male` (color picker). |
| `gender.female` | hex with `#` | `#CC79A7` | Same as `gender.male`, for "weiblich". Bound by `parameters.gender_color_female`. |
| `animation` | boolean | `false` | Disable for reports — animations don't translate to .docx. |
| `aspect_ratio` | number | `2.0` | width:height. Affects on-screen rendering and the embedded image size. |
| `max_height_ratio` | number | – (off) | Tallest a chart may grow, as a multiple of its width (height ÷ width; `1.0` = square). A horizontal bar chart (see `elements.bar.max_columns`) that would grow taller is split into the fewest equally big partial plots that each fit (category counts per part differ by at most one). All parts share one value axis, sit in a single figure with one caption, and each get their own alt text led by "Part i of k"; in the DOCX each part becomes its own image. |
| `font.family` | string | `Arial` | Overridden at runtime by the `font` parameter. |
| `font.size` | number (pt) | `12` | Used for tick labels and legend. |
| `font.color` | hex w/o `#` | `555555` | |
| `title.display` | boolean | `true` | `false` hides every chart's title, regardless of the block's `title:` field. |
| `title.position` | enum | `top` | `top` \| `bottom` \| `left` \| `right`. |
| `title.align` | enum | `center` | `start` \| `center` \| `end`. |
| `title.color` | hex w/o `#` | `1A1A1A` | |
| `legend.display` | boolean | `true` | |
| `legend.position` / `.align` | enums | `top` / `center` | Same vocab as `title.*`. |
| `tooltip.enabled` | boolean | `true` | |
| `scales.x.begin_at_zero` / `scales.y.begin_at_zero` | boolean | `false` / `true` | |
| `scales.{x,y}.grid_display` | boolean | `true` | |
| `scales.{x,y}.grid_color` | CSS color | `rgba(0,0,0,0.08)` | Accepts hex or `rgba(…)`. |
| `scales.{x,y}.tick_color` | hex w/o `#` | `888888` | |
| `scales.y.trim_to_data` | boolean | `false` | Non-stacked `bar` charts only: starts the y-axis at the nearest round tick below the smallest plotted value instead of at 0 (e.g. a step of 5 and a minimum of 132 start the axis at 130). The tick step is auto-computed to a "nice" 1/2/5×10ⁿ number and forced via `ticks.stepSize` so every gridline lands on that same round grid. No effect on stacked bars, `line`/`pie`/`doughnut`/`pyramid`/`distance` charts, or when the smallest value is `<= 0`. |
| `elements.line.tension` | number 0–1 | `0.0` | `0` = straight; `~0.4` = smooth curves. |
| `elements.line.point_radius` | px | `3` | |
| `elements.bar.border_radius` | px | `0` | Rounded bar corners. |
| `elements.bar.bar_percentage` | number 0–1 | `0.9` | Fraction of category slot used by bars. |
| `elements.bar.max_columns` | integer | – (off) | Most categories a `bar` chart shows as vertical columns. With more categories it flips to horizontal bars (categories on the y-axis) and grows in height: the aspect ratio is scaled by `max_columns / categories`, so each bar keeps the thickness it had at exactly `max_columns`. Applies to stacked bars too; no effect on other chart types. In the DOCX a chart taller than the page is shrunk to fit the content height. |

---

<a id="en-recipes"></a>

## Recipes

### Provide a label in both languages

```yaml
parameters:
  office:
    label:
      de: "Schule"
      en: "School"
    type: text
    default: "Ministry"
```

The form shows "Schule" when the UI is German and "School" when it is English. A label that reads the same in both languages can stay a plain string.

### Expose a config field as a user-overridable parameter

Add a `parameters:` entry whose `bind:` points at the dotted path:

```yaml
parameters:
  body_font_size:
    label:
      de: "Schriftgröße des Texts (pt)"
      en: "Body font size (pt)"
    type: number
    bind: export.font.size      # no `default:` — preset is at the bound leaf

export:
  font:
    size: 11                    # this is the form's prefill
```

The user's value is written back to `export.font.size` at runtime; the rest of the pipeline sees the override.

### Add a new bundled template

1. Drop a `.md` file into [templates/](templates/) (e.g. `templates/quarterly.md`).
2. Add a new entry under `template.files:`:

   ```yaml
   template:
     files:
       - label: "Standard Report"
         file: report_template.md
       - label:
           de: "Quartalsübersicht"
           en: "Quarterly Snapshot"
         file: quarterly.md
   ```

3. Restart `npm run dev` (Vite picks up new template files only on dev-server start).

### Make all sections decimal-numbered with a TOC

```yaml
export:
  section_numbering: true
  toc: true
```

When `toc: true`, Word will prompt **"This document contains references that may refer to other files. Do you want to update them?"** on first open — clicking *Yes* materialises the TOC entries. This is standard `docx`-package behavior.

### Make smallest-group masking a per-report choice

Already bound in the shipped config:

```yaml
parameters:
  smallest_group:
    label:
      de: "Schwellenwert kleinste Gruppe"
      en: "Smallest group threshold"
    type: number
    bind: dataParameters.smallestGroup

data_parameters:
  smallest_group: 5
```

The number field appears in Step 4; the user can raise it for stricter masking or lower it (down to 1, disabling masking) when working with non-sensitive data.

### Force landscape page orientation without exposing it to the user

Remove the `page_orientation` parameter entry but keep the preset:

```yaml
export:
  page:
    orientation: landscape
```

The exporter auto-swaps A4 width/height based on `orientation`, so margins/page numbers continue to lay out correctly.

---

<a id="en-cross-references"></a>

## Cross-references

- [README.md](README.md) — user-facing summary
- [src/modules/i18n/](src/modules/i18n/index.ts) — translation layer; default locale and label resolution
- [src/modules/config/](src/modules/config/index.ts) — config parser; the schema is exactly what's parsed there
- [src/modules/parameters/](src/modules/parameters/index.ts) — form builder, `bind:` resolution
- [src/modules/exporter/](src/modules/exporter/index.ts) — consumer of `export.*`
- [src/modules/renderer/chart.ts](src/modules/renderer/chart.ts) — consumer of `charts.*`

<sub>[↑ Back to top](#reportix--configyaml-handbuch--handbook) · [Jump to the German version ↓](#-deutsch)</sub>

