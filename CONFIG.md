<img src="img/ondatix_Logo_V1_dunkler_Hintergrund_SVG.svg" alt="ondatix Logo" class="logo" height="80" align="right"/><br><br>

# reportix — `config.yaml` Handbuch · handbuch

`config.yaml` is the entry point that configures the app — a thin **manifest** listing the per-section files under `config/` (`parameters.yaml`, `data.yaml` — which also carries the `preprocessing:` section — `template.yaml`, `data_protection.yaml`, `export.yaml`, `charts.yaml`), which are merged at build time. This handbuch is **bilingual**: an English and a German version of the same reference.

`config.yaml` ist der Einstiegspunkt zur Konfiguration der App — ein schlankes **Manifest**, das die Abschnittsdateien unter `config/` auflistet (`parameters.yaml`, `data.yaml` — enthält auch den Abschnitt `preprocessing:` —, `template.yaml`, `data_protection.yaml`, `export.yaml`, `charts.yaml`), die zur Build-Zeit zusammengeführt werden. Dieses Handbuch ist **zweisprachig**: eine englische und eine deutsche Fassung derselben Referenz.

**🌐 Language / Sprache:** **[Deutsch ↓](#-deutsch)** · **[English ↓](#-english)**

> **Keep both versions in sync.** Whenever `config.yaml` or the config schema changes, update **both** the English and the German sections below in the same commit. See [CLAUDE.md](CLAUDE.md).
>
> **Beide Fassungen synchron halten.** Wird `config.yaml` oder das Konfigurationsschema geändert, müssen **beide** Abschnitte (Englisch und Deutsch) im selben Commit aktualisiert werden. Siehe [CLAUDE.md](CLAUDE.md).

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
- [`data_protection:`](#de-data-protection)
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
data_protection:   # Maskierungsschwelle für aggregierte Zählwerte
export:            # DOCX-Gestaltung und Metadaten
charts:            # globale Standardwerte für die Diagrammdarstellung
```

Alle Abschnitte sind optional außer `parameters:`, `data:` und `template:`; in der Praxis benötigt man für jeden nicht-trivialen Bericht jedoch auch `export:` und `charts:`.

---

<a id="de-parameters"></a>

## `parameters:`

Der Abschnitt `parameters` steuert das in Schritt 3 („Berichtsparameter") dargestellte Formular. Jeder Eintrag ist ein Formularfeld.

```yaml
parameters:
  title:
    label: "Titel"            # einfacher String — in jeder Sprache gleich
    type: text
    default: "Bericht"
  office:
    label:                    # oder eine Sprachzuordnung (siehe unten)
      de: "Behörde"
      en: "Authority"
    type: text
    default: "Ministerium"
  font_size:
    label: "Schriftgröße des Texts (pt)"
    type: number
    bind: export.font.size
```

Jeder Parameter kann zusätzlich `definition:` (nur Deutsch) oder `info:` (zweisprachig) tragen — der Text erscheint als anklickbarer ⓘ-Tooltip neben der Beschriftung (siehe [Tooltips](#de-tooltips)).

<a id="de-localized-labels"></a>

### Lokalisierte Beschriftungen (`label:`)

Die Oberfläche wird in **Deutsch (Standard)** und **Englisch** ausgeliefert, umschaltbar über die Sprachauswahl oben in der App. Daher kann jedes `label:` in **zwei Formen** geschrieben werden:

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

> **Wichtig — `bind:`-Pfade verwenden die `AppConfig`-Struktur (camelCase), nicht die rohen YAML-Schlüssel.** Die meisten Blätter heißen in beiden gleich (`export.font.size`, `export.page.orientation`), mehrwortige Schlüssel jedoch nicht: binde an `export.pageNumbers.position`, `export.sectionNumbering`, `dataProtection.smallestGroup` — **nicht** an die snake_case-Form `export.page_numbers.show` usw. Ein `bind:` auf einen nicht existierenden Pfad bleibt **stillschweigend wirkungslos** (die Überschreibung erreicht den Verbraucher nie). Der Parser bildet snake_case-YAML auf camelCase ab (siehe [src/modules/config/](src/modules/config/index.ts)).

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

- **`palette`** — Radiogruppe; jede Option zeigt den Palettennamen und einen waagerechten Streifen ihrer tatsächlichen Farbmuster. Gebunden an `charts.palette`. Optionen müssen Paletten-IDs aus [src/modules/palettes/](src/modules/palettes/index.ts) entsprechen (`okabe-ito`, `tol-bright`, `tol-muted`, `ibm`, `grayscale`).
- **`font`** — Radiogruppe; jede Optionsbeschriftung wird in der jeweiligen Schriftart dargestellt. An nichts gebunden (kuratiertes Thema — bildet eine Schrift-ID auf einen CSS-Stack, eine DOCX-Familie und einen Anzeigenamen ab, via [src/modules/fonts/](src/modules/fonts/index.ts)). Optionen müssen Schrift-IDs entsprechen (`verdana`, `tahoma`, `arial`, `georgia`).
- **`page_orientation`** — Icon-Radios mit Seitenform-Symbolen (Hoch-/Querformat) statt Text. Gebunden an `export.page.orientation`. Optionen: `portrait`, `landscape`. Werte sind übersetzungsfrei; die Beschriftungen kommen aus dem i18n-Modul.
- **`page_numbers`** — Icon-Radios mit Seitensymbolen für die Position der Seitenzahl. Gebunden an `export.pageNumbers.position`. Optionen: `left`, `center`, `right`, `none` (`none` blendet die Seitenzahl aus).

Alle Schlüssel folgen weiterhin dem Standardschema (einschließlich lokalisierter `label:`); nur ihre UI-Darstellung ist besonders.

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

**Vorlagenabhängiger Datenschritt.** Der Datenschritt zeigt nur die Blätter und Spalten, deren `include` die `id` der gewählten Vorlage enthält (bzw. die kein `include` haben). So fragt eine Vorlage nur die Daten ab, die sie tatsächlich nutzt. Ausgeschlossene Blätter/Spalten erzeugen keine Warnungen, da sie gar nicht abgefragt werden.

**Hinweis zu den `Zeitraum_*`-Blättern.** Aus den `Zeitraum_*`-Ereignisblättern wurden Spalten bewusst entfernt, die Stammdaten doppelt führten — diese werden zur Laufzeit über den Join mit `Stichtag` (Schlüssel `PersNr`) ergänzt (siehe [`preprocessing:`](#de-preprocessing)). Ausnahme: `Zeitraum_Bewerbung` hat einen eigenen Schlüssel (`BewerberID`) und wird nicht mit `Stichtag` verknüpft, behält seine Personenmerkmale also direkt.

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

Eine Mutation fügt einem Datensatz eine Spalte mit einer **einfachen Wenn-Dann-Sonst-Regel** hinzu: Wo die Bedingung für den `from`-Wert zutrifft, erhält die neue `column` den `then`-Wert, sonst `else` (Standard `""`). So leiten die StMAS-Berichte die Klassifikation `Beamte`/`Tarifbeschäftigte` aus `Entgeltgruppe / Besoldungsgruppe` ab und Ereignis-Flags wie `Beförderung (ja/nein)` aus `Maßnahmenart`.

```yaml
preprocessing:
  mutations:
    - dataset: Stichtag                          # Datensatz, der die Spalte erhält
      column: Beamte                             # neue (oder überschriebene) Spalte
      definition: "Statusrechtliche Unterscheidung …"  # optional (Metadaten)
      from: "Entgeltgruppe / Besoldungsgruppe"   # Quellspalte, die die Bedingung testet
      when: { starts_with: [A, B, R, W] }        # Bedingung (weglassen → „Wert ist truthy")
      then: "Ja"
      else: "Nein"                               # optional (Standard "")
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `dataset` | String | — | Datensatz, dem die Spalte hinzugefügt wird (in eine abgeleitete Kopie). |
| `column` | String | — | Name der neuen (oder überschriebenen) Spalte. |
| `definition` | String | — | Optional. Definition der abgeleiteten Spalte (Metadaten), analog zu `.sheets[].columns[].definition`. |
| `from` | String | — | Quellspalte, deren Wert die Bedingung testet. |
| `when` | Objekt | truthy | Bedingung auf `from` (siehe Operatoren). Weglassen → „Wert ist truthy". |
| `then` | beliebig | — | Wert, wenn die Bedingung zutrifft. |
| `else` | beliebig | `""` | Wert sonst. |

**Bedingungsoperatoren** (innerhalb `when`, per UND verknüpft; skalare Operatoren akzeptieren auch eine Liste = „eines davon"): `equals`, `not_equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches` (Regex), `gt`/`gte`/`lt`/`lte` (numerisch), `empty` (bool), `truthy` (bool — `true`/`Ja`/`Yes`/`1`). String-Vergleiche sind NFC-normalisiert und getrimmt.

### `joins`

Zeilen aus einem Blatt mit Spalten anreichern, die über einen gemeinsamen Schlüssel in einem anderen Blatt nachgeschlagen werden. Das Ergebnis wird unter `name` abgelegt; `name` = `left` reichert die Quelle direkt an.

```yaml
preprocessing:
  joins:
    - name: Zeitraum_Befoerderung   # Ausgabe-Datensatz (= left → reichert in place an)
      left: Zeitraum_Befoerderung   # Basis; eine Ausgabezeile je left-Zeile (left join)
      right: Stichtag               # nachgeschlagenes Blatt
      on: PersNr                    # gemeinsamer Schlüssel (oder left_on / right_on)
      type: left                    # left (unpassende behalten) | inner (verwerfen)
      # select weglassen → alle right-Spalten übernehmen, die links fehlen
      # select: [Beamte, {column: Org, as: Organisationseinheit}]   # explizit
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

**Warum die StMAS-Vorlagen beides brauchen.** Die `Zeitraum_*`-Ereignisblätter (z. B. `Zeitraum_Befoerderung`) enthalten nur Ereignisdaten. Mutationen leiten die Klassifikation `Beamte`/`Tarifbeschäftigte` (aus `Entgeltgruppe / Besoldungsgruppe`) auf `Stichtag` ab sowie die Flags `Beförderung (ja/nein)` / `Höhergruppierung genehmigt` (aus `Maßnahmenart`) auf dem Ereignisblatt; der Join `Stichtag → Zeitraum_Befoerderung` trägt die Klassifikation dann über `PersNr` an jedes Ereignis. Zusammen liefern sie jede Spalte, die die Beförderungs-Diagramme in `filter:` und `y:` referenzieren.

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

**Generiert, nicht von Hand gepflegt.** Die Dateien unter `templates/` sind **Build-Artefakte** (git-ignoriert). Sie werden aus einer einzigen Master-Datei `templates/master.md` von `scripts/gen-templates.ts` erzeugt (`npm run gen:templates`, als `predev`/`prebuild`/`pretest`-Hook verdrahtet): Für jeden Eintrag mit `id` **und** `file` wird eine gefilterte Kopie nach `templates/<file>` geschrieben. Abschnittsmarker im Master (`<!-- include: <id> -->` … `<!-- /include -->`, unmarkierter Inhalt landet in jeder Vorlage) steuern, welche Vorlage welchen Block erhält. Bearbeiten Sie `templates/master.md`, nicht die generierten Dateien.

**Hard-Fail-Verhalten.** Ist eine hier referenzierte `file:` nicht im Bundle vorhanden, bricht die App beim Start ab und listet Fehlendes und Verfügbares auf. Das fängt Tippfehler und vergessene Dateien früh ab.

**Minimum: ein Eintrag.** Eine leere `files:`-Liste führt ebenfalls zum Hard-Fail.

---

<a id="de-data-protection"></a>

## `data_protection:`

```yaml
data_protection:
  smallest_group: 5   # gebunden durch parameters.smallest_group (falls ausgespielt)
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `smallest_group` | Zahl | `5` | Aggregierte Werte strikt unterhalb dieses Werts und größer als null werden maskiert. |

**Wo es gilt.** Nur bei zählartigen Aggregationen (`count`, `sum`, `share_total`, `share_group`). Mittelwert, Median, Minimum und Maximum werden nicht maskiert, da sie keine Gruppengrößen offenlegen.

- **Tabellen:** betroffene Zellen werden als `<5` (bzw. der konfigurierte Schwellenwert) dargestellt.
- **Diagramme:** betroffene Balken/Segmente werden auf den Schwellenwert geklemmt, sodass ein kleiner Balken weiterhin gezeichnet wird, und der Tooltip zeigt `<5`.

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
| `section_numbering` | Boolean | `false` | Nummeriert Abschnittsüberschriften ab `<h2>` als `1.`, `1.1.`, `1.1.1.` — in der **Vorschau** über CSS-Zähler, im **DOCX** über mehrstufige Nummerierung pro Überschrift. Der Titel (`# {{title}}`, ein `<h1>`) wird als Dokumenttitel behandelt und nicht nummeriert. |
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

  font:
    family: Arial
    size: 12
    color: "555555"

  title:
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

  elements:
    line:
      tension: 0.0
      point_radius: 3
    bar:
      border_radius: 0
      bar_percentage: 0.9
```

| Feld | Typ | Standard | Anmerkungen |
|---|---|---|---|
| `palette` | Paletten-ID | `okabe-ito` | Wird zur Renderzeit über das Paletten-Modul aufgelöst. Durch `parameters.palette` überschreibbar. |
| `animation` | Boolean | `false` | Für Berichte deaktivieren — Animationen lassen sich nicht in .docx übertragen. |
| `aspect_ratio` | Zahl | `2.0` | Breite:Höhe. Beeinflusst die Bildschirmdarstellung und die eingebettete Bildgröße. |
| `font.family` | String | `Arial` | Zur Laufzeit durch den `font`-Parameter überschrieben. |
| `font.size` | Zahl (pt) | `12` | Für Achsenbeschriftungen und Legende. |
| `font.color` | Hex ohne `#` | `555555` | |
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
| `elements.line.tension` | Zahl 0–1 | `0.0` | `0` = gerade; `~0.4` = weiche Kurven. |
| `elements.line.point_radius` | px | `3` | |
| `elements.bar.border_radius` | px | `0` | Abgerundete Balkenecken. |
| `elements.bar.bar_percentage` | Zahl 0–1 | `0.9` | Anteil des Kategorieabschnitts, den die Balken einnehmen. |

---

<a id="de-recipes"></a>

## Rezepte

### Eine Beschriftung in beiden Sprachen angeben

```yaml
parameters:
  office:
    label:
      de: "Behörde"
      en: "Authority"
    type: text
    default: "Ministerium"
```

Das Formular zeigt „Behörde" bei deutscher und „Authority" bei englischer Oberfläche. Eine in beiden Sprachen gleiche Beschriftung kann ein einfacher String bleiben.

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
    bind: dataProtection.smallestGroup

data_protection:
  smallest_group: 5
```

Das Zahlenfeld erscheint in Schritt 3; der Nutzer kann es für strengere Maskierung erhöhen oder (bis auf 1, womit die Maskierung deaktiviert wird) senken, wenn er mit nicht sensiblen Daten arbeitet.

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

- [CLAUDE.md](CLAUDE.md) — vollständige App-Spezifikation, Vorlagensyntax (Diagramm-/Tabellen-YAML-Blöcke, Callouts, Aggregation), Barrierefreiheitsregeln, Internationalisierung
- [README.md](README.md) — nutzerorientierte Zusammenfassung
- [src/modules/i18n/](src/modules/i18n/index.ts) — Übersetzungsschicht; Standardsprache und Beschriftungsauflösung
- [src/modules/config/](src/modules/config/index.ts) — Konfigurationsparser; das Schema entspricht exakt dem, was dort eingelesen wird
- [src/modules/parameters/](src/modules/parameters/index.ts) — Formularaufbau, `bind:`-Auflösung
- [src/modules/exporter/](src/modules/exporter/index.ts) — Verbraucher von `export.*`
- [src/modules/renderer/chart.ts](src/modules/renderer/chart.ts) — Verbraucher von `charts.*`

<sub>[↑ Zum Seitenanfang](#reportix--configyaml-handbuch--handbuch) · [Zur englischen Fassung ↑](#-english)</sub>

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
- [`data_protection:`](#en-data-protection)
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
data_protection:   # masking threshold for aggregated counts
export:            # DOCX styling and metadata
charts:            # global chart rendering defaults
```

All sections are optional except `parameters:`, `data:`, and `template:`, but in practice you'll want `export:` and `charts:` for any non-trivial report.

---

<a id="en-parameters"></a>

## `parameters:`

The `parameters` section drives the form rendered in Step 3 ("Report Parameters"). Each entry is one form field.

```yaml
parameters:
  title:
    label: "Title"            # plain string — same in every language
    type: text
    default: "Report"
  office:
    label:                    # or a per-locale map (see below)
      de: "Behörde"
      en: "Authority"
    type: text
    default: "Ministry"
  font_size:
    label: "Body font size (pt)"
    type: number
    bind: export.font.size
```

A parameter may additionally carry `definition:` (German only) or `info:` (bilingual) — the text appears as a clickable ⓘ tooltip next to the label (see [Tooltips](#en-tooltips)).

<a id="en-localized-labels"></a>

### Localized labels (`label:`)

The UI ships in **German (default)** and **English**, switchable via the language selector at the top of the app. So every `label:` may be written in **two forms**:

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

> **Important — `bind:` paths target the parsed `AppConfig` (camelCase), not the raw YAML keys.** Most leaves are spelled the same in both (`export.font.size`, `export.page.orientation`), but multi-word keys differ: bind to `export.pageNumbers.position`, `export.sectionNumbering`, `dataProtection.smallestGroup` — **not** the snake_case `export.page_numbers.show` etc. A `bind:` to a non-existent path **silently no-ops** (the override never reaches the consumer). The parser maps snake_case YAML → camelCase (see [src/modules/config/](src/modules/config/index.ts)).

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

- **`palette`** — radio group; each option shows the palette name plus a horizontal strip of its actual colour swatches. Bound to `charts.palette`. Options must match palette IDs registered in [src/modules/palettes/](src/modules/palettes/index.ts) (`okabe-ito`, `tol-bright`, `tol-muted`, `ibm`, `grayscale`).
- **`font`** — radio group; each option label is rendered in the actual typeface. Bound to nothing (curated theme — maps a font ID to a CSS stack, DOCX family, and display name via [src/modules/fonts/](src/modules/fonts/index.ts)). Options must match font IDs (`verdana`, `tahoma`, `arial`, `georgia`).
- **`page_orientation`** — icon radios showing page-shape symbols (portrait/landscape) instead of text. Bound to `export.page.orientation`. Options: `portrait`, `landscape`. Values are translation-free; captions come from the i18n module.
- **`page_numbers`** — icon radios showing page symbols for the page-number position. Bound to `export.pageNumbers.position`. Options: `left`, `center`, `right`, `none` (`none` hides the page number).

All keys still follow the standard schema (including localized `label:`); only their UI rendering is special.

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

**Template-scoped data step.** The data step shows only the sheets and columns whose `include` contains the selected template's `id` (or that have no `include`). A template therefore only asks for the data it actually uses; excluded sheets/columns produce no warnings because they are never requested.

**Note on the `Zeitraum_*` sheets.** Columns that duplicated master data were deliberately removed from the `Zeitraum_*` event sheets — they are supplied at runtime by joining with `Stichtag` (key `PersNr`; see [`preprocessing:`](#en-preprocessing)). Exception: `Zeitraum_Bewerbung` has its own key (`BewerberID`) and is not joined with `Stichtag`, so it keeps its person attributes directly.

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

A mutation adds a column to a dataset with a **simple if-else rule**: where the condition holds for the `from` value, the new `column` gets `then`, otherwise `else` (default `""`). This is how the StMAS reports derive the `Beamte`/`Tarifbeschäftigte` classification from `Entgeltgruppe / Besoldungsgruppe`, and event flags such as `Beförderung (ja/nein)` from `Maßnahmenart`.

```yaml
preprocessing:
  mutations:
    - dataset: Stichtag                          # dataset that receives the column
      column: Beamte                             # new (or overwritten) column
      definition: "Civil-servant vs. collective-agreement status …"  # optional (metadata)
      from: "Entgeltgruppe / Besoldungsgruppe"   # source column the condition tests
      when: { starts_with: [A, B, R, W] }        # condition (omit → "value is truthy")
      then: "Ja"
      else: "Nein"                               # optional (default "")
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `dataset` | string | — | Dataset the column is added to (as a derived copy). |
| `column` | string | — | Name of the new (or overwritten) column. |
| `definition` | string | — | Optional. Definition of the derived column (metadata), mirroring `.sheets[].columns[].definition`. |
| `from` | string | — | Source column whose value the condition tests. |
| `when` | object | truthy | Condition on `from` (see operators). Omit → "value is truthy". |
| `then` | any | — | Value written when the condition holds. |
| `else` | any | `""` | Value written otherwise. |

**Condition operators** (inside `when`, combined with AND; scalar operators also accept a list = "any of"): `equals`, `not_equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches` (regex), `gt`/`gte`/`lt`/`lte` (numeric), `empty` (bool), `truthy` (bool — `true`/`Ja`/`Yes`/`1`). String comparisons are NFC-normalized and trimmed.

### `joins`

Enrich rows in one sheet with columns looked up from another by a shared key. The result is stored under `name`; `name` = `left` enriches the source in place.

```yaml
preprocessing:
  joins:
    - name: Zeitraum_Befoerderung   # output dataset (= left → enrich in place)
      left: Zeitraum_Befoerderung   # base; one output row per left row (left join)
      right: Stichtag               # looked-up sheet
      on: PersNr                    # shared key (or left_on / right_on)
      type: left                    # left (keep unmatched) | inner (drop)
      # omit select → copy every right column not already on the left
      # select: [Beamte, {column: Org, as: Organisationseinheit}]   # explicit
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

**Why the StMAS templates need both.** The `Zeitraum_*` event sheets (e.g. `Zeitraum_Befoerderung`) carry only event data. Mutations derive the `Beamte`/`Tarifbeschäftigte` classification (from `Entgeltgruppe / Besoldungsgruppe`) on `Stichtag` and the `Beförderung (ja/nein)` / `Höhergruppierung genehmigt` flags (from `Maßnahmenart`) on the event sheet; the `Stichtag → Zeitraum_Befoerderung` join then carries the classification onto each event by `PersNr`. Together they supply every column the Beförderung charts reference in their `filter:` and `y:`.

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

**Generated, not hand-edited.** The files under `templates/` are **build artifacts** (git-ignored). They are generated from a single master, `templates/master.md`, by `scripts/gen-templates.ts` (`npm run gen:templates`, wired as a `predev`/`prebuild`/`pretest` hook): for every entry with an `id` **and** `file`, a filtered copy is written to `templates/<file>`. Section markers in the master (`<!-- include: <id> -->` … `<!-- /include -->`; unmarked content goes into every template) decide which template gets which block. Edit `templates/master.md`, not the generated files.

**Hard-fail behavior.** If any `file:` referenced here isn't present in the bundle, the app throws at startup listing what's missing and what's available. This catches typos and forgotten files early.

**Minimum: one entry.** An empty `files:` list also hard-fails.

---

<a id="en-data-protection"></a>

## `data_protection:`

```yaml
data_protection:
  smallest_group: 5   # bound by parameters.smallest_group (if exposed)
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `smallest_group` | number | `5` | Aggregated values strictly below this and greater than zero are masked. |

**Where it applies.** Count-like aggregation operations only (`count`, `sum`, `share_total`, `share_group`). Means, medians, min, and max are not masked because they don't reveal group sizes.

- **Tables:** affected cells render as `<5` (or the configured threshold).
- **Charts:** affected bars/slices are clamped to the threshold so a small bar is still drawn, and the tooltip displays `<5`.

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
| `section_numbering` | boolean | `false` | Numbers section headings starting at `<h2>` as `1.`, `1.1.`, `1.1.1.` — in the **preview** via CSS counters and in the **DOCX** via per-heading multilevel numbering. The title (`# {{title}}`, an `<h1>`) is treated as the document title and is not numbered. |
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

  font:
    family: Arial
    size: 12
    color: "555555"

  title:
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

  elements:
    line:
      tension: 0.0
      point_radius: 3
    bar:
      border_radius: 0
      bar_percentage: 0.9
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `palette` | palette ID | `okabe-ito` | Resolved at render time via the palettes module. Overridable by `parameters.palette`. |
| `animation` | boolean | `false` | Disable for reports — animations don't translate to .docx. |
| `aspect_ratio` | number | `2.0` | width:height. Affects on-screen rendering and the embedded image size. |
| `font.family` | string | `Arial` | Overridden at runtime by the `font` parameter. |
| `font.size` | number (pt) | `12` | Used for tick labels and legend. |
| `font.color` | hex w/o `#` | `555555` | |
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
| `elements.line.tension` | number 0–1 | `0.0` | `0` = straight; `~0.4` = smooth curves. |
| `elements.line.point_radius` | px | `3` | |
| `elements.bar.border_radius` | px | `0` | Rounded bar corners. |
| `elements.bar.bar_percentage` | number 0–1 | `0.9` | Fraction of category slot used by bars. |

---

<a id="en-recipes"></a>

## Recipes

### Provide a label in both languages

```yaml
parameters:
  office:
    label:
      de: "Behörde"
      en: "Authority"
    type: text
    default: "Ministry"
```

The form shows "Behörde" when the UI is German and "Authority" when it is English. A label that reads the same in both languages can stay a plain string.

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
    bind: dataProtection.smallestGroup

data_protection:
  smallest_group: 5
```

The number field appears in Step 3; the user can raise it for stricter masking or lower it (down to 1, disabling masking) when working with non-sensitive data.

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

- [CLAUDE.md](CLAUDE.md) — full app spec, template syntax (chart/table YAML blocks, callouts, aggregation), accessibility rules, internationalization
- [README.md](README.md) — user-facing summary
- [src/modules/i18n/](src/modules/i18n/index.ts) — translation layer; default locale and label resolution
- [src/modules/config/](src/modules/config/index.ts) — config parser; the schema is exactly what's parsed there
- [src/modules/parameters/](src/modules/parameters/index.ts) — form builder, `bind:` resolution
- [src/modules/exporter/](src/modules/exporter/index.ts) — consumer of `export.*`
- [src/modules/renderer/chart.ts](src/modules/renderer/chart.ts) — consumer of `charts.*`

<sub>[↑ Back to top](#reportix--configyaml-handbuch--handbuch) · [Jump to the German version ↓](#-deutsch)</sub>

