# TODO

- Warnings bei fehlenden Daten, aber trotzdem lauffähig

## Forks
- Main Fork
  - Generic config
  - Generic Template
- StMAS Fork
  - Data protection
  - Data preprocessing
  - Config
  - Template
  - German / Locale control


## README
- [x] Fill the README

## Parameters
- Data validation only throws warning

## Design
- [x] Prepare generic CSS
- [x] Apply ondatix theme

## Config
- [ ] Create generic config
- [ ] Create StMAS config
- [ ] Create config specification
- [ ] Add section numbering option and toc option
- [ ] Add parameter logic (parameters are set in config, but can be overwritten by users)

## Charts and Tables
- [ ] Accessible charts
  - [ ] Actual numbers in the charts?
  - [ ] Titles?
- [ ] Well-formed tables
  - [ ] Format (centered or block)
  - [ ] Config options

## Modules
- [ ] Write module specifications
- [ ] Write tests for each module
- [ ] Finish and test modules

## Templates
- [ ] Create the StMAS Template
  - [ ] Table section at the end
  - [ ] Data Preprocessing
- [x] Polish callouts

## License
- [x] Validate License with Team

## Security
- [x] Subresource Integrity (SRI)
- [x] Content Security Policy (CSP)
- [x] Obligatory HTTPS

## Penetration Test
- [x] [LSI Informationsblatt](https://www.lsi.bayern.de/mam/aktuelles/lsi-info_t03_penetrationstest.pdf)
  - Folgende Punkte stellen den empfohlenen Umfang dar, der bei einem Webcheck überprüft werden sollte:
    - [ ] Einsatz von Transportverschlüsselung (https)
    - [ ] Validierung von Benutzereingaben (z.B. in Kontaktformulare, Kommentarfunktionen gegen Cross-Site-Scripting)
    - [ ] Absicherung des Session-Handlings
    - [ ] Umsetzung der Zugriffskontrolle (z.B. interne Bereiche, geschützte Dateien und Verzeichnisse)Behandlung von Fehlern (z.B. Informationsabfluss durch Fehlermeldungen)
    - [x] Ausführung von Datenbank-Abfragen (z.B. gegen SQL-Injections)
    - [ ] Möglichkeiten zum Datei-Upload (z.B. präparierte Dateien mit Schadcode)
    - [ ] Validierung von „versteckten“ Parametern (z.B. in Cookies oder POST-Requests)
    - [ ] Aktualität von Softwareversionen (z.B. MySQL, PHP, Javascript, Angular)
  - [ ] OWASP (Open Web Application Security Project) Top 10 prüfen (es gibt Open Source Software dafür)
  - [ ] Sollten im Outsourcing betriebene Systeme (z.B. ein externer Hosting-Provider) überprüft werden, muss der Vertrag mit diesem Dienstleister eine s.g. „Permission to attack“ enthalten, bzw. diese muss separat gegeben werden.

## Accessibility
[WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/glance/):
1. Wahrnehmbarkeit:
Inhalte müssen so präsentiert werden, dass sie von den Nutzern mit verschiedenen Wahrnehmungsmöglichkeiten aufgenommen werden können.
- [ ] Alternativtexte für Bilder
- [ ] Untertitel für Videos
- [ ] Textskalierbarkeit bis 200 %
- [ ] ausreichende Farbkontraste

2. Bedienbarkeit: Die Benutzeroberfläche und Navigation müssen vollständig bedienbar sein – auch ohne Maus.
- [ ] Tastaturbedienbarkeit
- [ ] sichtbarer Fokus bei Interaktionen
- [ ] logische Reihenfolge der Inhalte

3. Verständlichkeit:
Informationen und Bedienung müssen einfach zu verstehen und vorhersehbar sein.
- [ ] konsistente Navigation
- [ ] eindeutige Linktexte
- [ ] gut sichtbare Fehlermeldungen in Formularen

4. Robustheit: Inhalte sollen so gestaltet sein, dass sie zuverlässig von Benutzeragenten (z. B. Screenreadern) interpretiert werden können.
- [ ] saubere HTML-Struktur
- [ ] Nutzung von ARIA-Rollen, wo nötig

