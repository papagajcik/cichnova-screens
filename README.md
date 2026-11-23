# Čichnova Screens – desktopová administrace

Aplikace pro Windows, Linux a macOS, která otevře administraci Čichnova Screens (`https://cichnovabrno.papousek.eu/admin/`) v samostatném okně. Samotná aplikace se sama aktualizuje z tohoto GitHub repozitáře.

## Instalace

Nejnovější instalátor stáhněte v sekci **Releases** tohoto repozitáře.

| Systém | Soubor | Poznámka |
| --- | --- | --- |
| Windows | `Cichnova-Screens-Admin-Setup-x.y.z.exe` | Instalace jedním klikem. Pokud se ukáže SmartScreen, zvolte „Další informace“ a „Přesto spustit“. |
| Linux | `Cichnova-Screens-Admin-x.y.z-linux.AppImage` nebo `.deb` | AppImage nejdřív povolte ke spuštění (`chmod +x`). |
| macOS | `Cichnova-Screens-Admin-x.y.z-mac.dmg` | Přetáhněte aplikaci do složky Aplikace. Při prvním spuštění klikněte pravým tlačítkem a zvolte Otevřít. Když macOS hlásí poškozený soubor, spusťte v Terminálu `xattr -cr "/Applications/Cichnova Screens Admin.app"`. |

## Přihlášení a aktualizace administrace

Aplikace zobrazuje stejnou administraci jako webový prohlížeč, takže nové funkce administrace (například Poznámky a úkoly) se objeví hned po nahrání na server. Přihlášení zůstává uložené mezi spuštěními.

## Automatické aktualizace aplikace

- Windows a Linux (AppImage): aplikace při startu a pak každé 4 hodiny hledá novou verzi, stáhne ji sama a zeptá se, jestli se má restartovat.
- macOS: bez placeného certifikátu Apple se aplikace nemůže nainstalovat sama. Když vyjde nová verze, aplikace nabídne otevření stránky ke stažení.
- Ručně: **Nápověda → Zkontrolovat aktualizace**.

## Jiný server

**Soubor → Změnit adresu serveru…** přepne aplikaci na jinou adresu, například testovací server. Tlačítko „Výchozí adresa“ vrátí původní.

## Vydání nové verze (pro správce repozitáře)

1. Nahrajte projekt do repozitáře na GitHubu (větev `main`). Repozitář musí být veřejný, jinak se aplikace nemůže aktualizovat.
2. V **Settings → Actions → General → Workflow permissions** zvolte **Read and write permissions**.
3. Po každém pushi na `main` se spustí workflow **Build and release**. Když ještě neexistuje vydání s verzí z `package.json`, sestaví aplikaci pro všechny tři systémy a vydá ji v Releases.
4. Pro aktualizaci uživatelů zvyšte `version` v `package.json` (například `1.0.0` na `1.0.1`) a pushněte. Stejná verze se podruhé nevydává.

Lokální spuštění: `npm install` a `npm start`.

### Podepisování pro macOS (volitelné)

S Apple Developer účtem lze aktualizace na macOS zapnout i bez ručního stahování: přidejte do repozitáře secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, v `package.json` odstraňte `"identity": null` a nastavte `"macSigned": true`.
