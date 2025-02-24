### **Bendra Dokumentacija - Sistemos Srautas**

# **Pagrindinės Priklausomybės**

Šis dokumentas paaiškina sistemos srautus, priklausomybes bei visas operacijas, vykstančias vidiniuose valdiklių (controller) moduliuose.

---

## **1. Pagrindiniai Sistemos Komponentai**

- **Ingredientai** | Sistemos srautas prasideda nuo ingredientų kūrimo ir jų valdymo.
- **Patiekalai** | Sekantis srautas yra pagrindinių patiekalų kūrimas iš ingredientų.
- **Savaitės meniu** | Iš patiekalų sąrašo sudaromi savaitės meniu, kurie gali būti sudaromi atsižvelgiant į gamintojo poreikius.
- **Savaitės planas** | Aktyvus savaitės valdiklis, skirtas prisegti atitinkamą savaitės meniu prie aktyvaus savaitės plano. Prie plano taip pat priskiriami klientai.
- **Klientai** | Klientai gali būti pridedami prie sistemos savarankiškai iš gamintojo pusės arba per išsiųstą elektroninę formą, kurią klientai gauna į savo el. pašto dėžutę ir turi užpildyti.
- **Užsakymų valdymas ir komponentai** | Skiltis, kurioje gamintojai gali matyti ir stebėti visų tam tikros dienos užsakymus, generuoti ingredientų sąrašą, žymėti užsakymų įvykdymą ir kt.

**--! Svarbūs aspektai !--**

## **Atnaujinimai**

Dauguma sistemos skaičiavimų atliekama prieš siunčiant duomenis klientui. Tam tikri skaičiavimai nėra saugomi dokumentuose. Pagrindinis komponentas, kuris perskaičiuojamas pasikeitus ingredientams, yra **patiekalas**. Likusi sistemos dalis skaičiuoja duomenis prieš jų gavimą ir nesaugo bendro kalorijų kiekio dokumente, siekiant palengvinti galines operacijas ir sumažinti priklausomybes.

## **Middleware**

Middleware `checkPlanFeatures()` tikrina, ar gamintojas nepasiekė savo plano limito, pridedant ingredientus, patiekalus, savaitės meniu, savaitės planus ir klientus.

## **Planų Keitimas (Downgrade)**

Keičiant prenumeratos planą iš aukštesnio į žemesnį, tam tikri duomenys yra archyvuojami. Gamintojai informuojami apie archyvavimo procesą, tačiau pirmoje MVP stadijoje archyvuotų duomenų peržiūra yra ribota.

- Negalima peržiūrėti archyvuotų **ingredientų** ir **patiekalų**.
- Galima peržiūrėti tik archyvuotus **savaitės meniu**.

---

## **2. Detalus Sistemos Srauto Aprašymas** (API versija `/api/v1`)

### **2.1 Ingredientai**

#### Užklausų Metodai:

- **POST** | `/ingredients` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali sukurti ingredientą savarankiškai arba naudoti AI įrankį pridedant ingredientą patiekalo kūrimo metu. Gamintojas negali pridėti ingredientų su identišku pavadinimu.

- **GET** | `/ingredients` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visus ingredientus, kurie nėra ištrinti ar pašalinti iš sistemos **deletedAt: null**. Taip pat galima ieškoti ingredientų pagal atitinkamą paieškos įvestį.

- **PUT** | `/ingredients/:ingredientId` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali atnaujinti ingredientą ir pakeisti tam tikrus duomenis. Atliekant ingredientų atnaujinimą, vykdomos galinės operacijos, kadangi ingredientai yra vienas pagrindinių sistemos komponentų, turinčių didelę įtaką duomenų atnaujinimams. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuotas duomenų atnaujinimas.
  **GET** : `/ingredients`

  **-- Galines operacijos --**:

  - Atnaujinant ingredientą, paleidžiamos galinės operacijos. Perskaičiuojamos visų patiekalų maistinės vertės, kur ingredientas yra naudojamas.
  - Po sėkmingo atnaujinimo siunčiama **WebSocket** žinutė `ingredient_updated_in_meals`, kuri informuoja, kad operacija įvykdyta sėkmingai, ir kliento pusėje duomenys gali būti atnaujinami:
    **GET** : `/meals`
    **GET** : `/weekly-menu/:id` (su kiekvienu id)

- **DELETE** | `/ingredients/:ingredientId` (dokumentacijos nuoroda: `URL`)
  Gamintojas taip pat gali pašalinti ingredientus iš sistemos naudojant **Soft delete** principą. Po sėkmingo pašalinimo priekinėje dalyje turi būti inicijuotas duomenų atnaujinimas.
  **GET** : `/ingredients`

##### **Papildomos uzklausu operacijos**:

- **GET** | `/ingredients/search` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali ieškoti tam tikrų ingredientų tiesiogiai kurdamas patiekalą.

- **POST** | `/ingredients/search-ai` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali ieškoti ingredientų naudojant OpenAI API, pateikdamas užklausą su ingrediento pavadinimu ir kitais reikalingais duomenimis.

- **GET** | `/ingredients/nutrition/:ingredientId` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali gauti apskaičiuotas ingrediento maistines vertes pagal nurodytą kiekį.

### **2.2 Patiekalai**

#### Priklausomybės:

- Ingredientai

#### Užklausų Metodai:

- **POST** | `/meals` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali sukurti patiekalą savarankiškai. Jis gali pridėti nuotrauką, ingredientus iš savo ingredientų sąrašo. Jei gamintojas neturi reikiamų ingredientų, jis gali juos pridėti patiekalo kūrimo metu arba ieškoti ingredientų naudojant `OpenAI API`. Gamintojas gali sukurti tik vieną patiekalą su tuo pačiu pavadinimu. Nuotrauka taip pat turi atitikti API dokumentacijoje nurodytus reikalavimus.

- **GET** | `/meals` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visus savo sukurtus patiekalus, kurie nėra ištrinti ar pašalinti iš sistemos **deletedAt: null**. Taip pat galima ieškoti patiekalų pagal įvairius filtrus bei atlikti paiešką pagal pateiktą užklausą.

- **PUT** | `/meals/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali atnaujinti savo patiekalus bei pakeisti tam tikrus duomenis. Kai patiekalas sėkmingai atnaujinamas priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/meals`
  **GET** : `/weekly-menu/:id`

- **DELETE** | `/meals/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas taip pat gali pašalinti patiekalus iš sistemos naudojant **Soft delete** principą. Kai patiekalas sėkmingai ištrinamas kliento pusėje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/meals`

### **2.3 Savaitės meniu **

#### Priklausomybės:

- Patiekalai
- Ingredientai

#### Užklausų Metodai:

- **POST** | `/weekly-menu` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali sukurti savaitės meniu, kuriame galima pridėti įvairius patiekalus prie atitinkamų dienų iš savo sukurtų patiekalų sąrašo. Savaitės meniu pavadinimas turi būti unikalus ir negali kartotis. Vienas gamintojas gali turėti tik vieną tokį patį savaitės meniu pavadinimą.

- **GET** | `/weekly-menu` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visus savaitės meniu, kurie nėra ištrinti ar pašalinti iš sistemos **deletedAt: null**. Taip pat galima ieškoti savaitės meniu pagal paieškos užklausą bei pasirinktus filtrus. Gaunami tik savaitės meniu pavadinimas, aprašymas bei dietiniai apribojimai.

- **PATCH** | `/weekly-menu/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali atnaujinti savaitės meniu ir pakeisti tam tikrus duomenis. Atnaujinimo metu galima keisti tik pavadinimą, aprašymą ir dietinius pasirinkimus. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-menu`
  **GET** : `/weekly-menu/:id`
  **GET** : `/weekly-plan`

- **DELETE** | `/weekly-menu/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pašalinti savaitės meniu iš sistemos naudojant **Soft delete** principą. Savaitės meniu negali būti ištrinamas, jei jis yra priskirtas prie `aktyvaus savaitės plano`. Jei savaitės meniu sėkmingai pašalinamas kliento pusėje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-menu`

- **PATCH** | `/weekly-menu/archive/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali archyvuoti nebenaudojamus savaitės meniu, siekdamas atlaisvinti limitą ir pridėti daugiau savaitės planų. Galima archyvuoti tik `SAVAITĖS MENIU`, kurie nėra aktyvūs. Po sėkmingo archyvavimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-menu`

- **PATCH** | `/weekly-menu/unarchive/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali išarchyvuoti savaitės meniu, jei reikia jį vėl naudoti. Prieš išarchyvuojant, tikrinamas gamintojo savaitės meniu limitas su `checkPlanFeatures` middleware. Po sėkmingo išarchyvavimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-menu`

- **GET** | `/weekly-menu/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna atitinkamo savaitės meniu duomenis, kurie nėra ištrinti ar pašalinti iš sistemos **deletedAt: null**. Gamintojas gauna visos savaitės duomenis, įskaitant visas savaitės dienas ir prie jų priskirtus patiekalus. Kliento pusėje apskaičiuojamos kiekvienos dienos kalorijų normos ir maistinės vertės.

- **POST** | `/weekly-menu/:id/meal` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pridėti patiekalą prie tam tikros savaitės dienos, jei savaitės meniu nėra aktyvus sistemoje. Jei savaitės meniu jau yra aktyvus, šio veiksmo atlikti negalima.

- **DELETE** | `/weekly-menu/:id/meal` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pašalinti patiekalą iš tam tikros savaitės dienos, jei savaitės meniu nėra aktyvus sistemoje. Jei savaitės meniu yra aktyvus, šio veiksmo atlikti negalima.

### **2.4 Savaitės planas **

#### Priklausomybės:

- Savaitės meniu
- Klientai

#### Užklausų Metodai:

- **PATCH** | `/weekly-plan/set-timezone` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali nustatyti arba keisti savo laiko juostą (UTC) pagal vietovę. Pagal pasirinktą UTC laiko juostą bus rodomas pagrindinis savaitės meniu. Prieš kuriant bet kokį savaitės planą, gamintojas privalo nustatyti savo laiko juostą.

- **GET** | `/weekly-plan` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna tikslios savaitės planą, kuris sukuriamas automatiškai, kai vartotojas naršo tarp savaičių kliento pusėje. Pagrindinis plano šablonas sukuriamas automatiškai ir nereikalauja papildomų veiksmų. Jei gamintojas dar nenustatė savo laiko juostos, planas nėra automatiškai generuojamas, o užklausa tiesiog ignoruojama. Užklausa siunčia klientui savaitės duomenis pagal metus ir savaitės numerį, jei validacija sėkminga.

- **PATCH** | `/weekly-plan/:id/assign-menu` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali priskirti savo sukurtą savaitės meniu prie atitinkamo savaitės plano, kuris buvo sukurtas automatiškai. Prieš pridedant kiekvieną `SAVAITĖS MENIU`, atliekamas plano limitų skaičiavimas su `checkWeeklyPlanMenu` middleware. Prie kiekvieno savaitės plano gali būti pridėtas tik vienas toks pat savaitės meniu. Negalima pridėti to paties meniu prie tos pačios savaitės. Priskiriant meniu, aktyvios savaitės duomenys taip pat susiejami su meniu, kad būtų galima stebėti jo aktyvumą. Priskirtas `SAVAITĖS MENIU` tampa `aktyvus` ir jo nebegalima modifikuoti. Po sėkmingo pridėjimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-plan`
  **GET** : `/weekly-menu`
  **GET** : `/weekly-menu/:id`

- **DELETE** | `/weekly-menu/delete-menu` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pašalinti priskirtą `SAVAITĖS MENIU` iš savaitės plano, jei jis nėra publikuotas. Taip pat pašalinami savaitės plano duomenys, kurie buvo susieti su meniu priskyrimo metu. Jei pašalintas `SAVAITĖS MENIU` nebeturi priskirtų savaitės planų, jis tampa `neaktyvus` ir gali būti modifikuojamas. Po sėkmingo pašalinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-plan`
  **GET** : `/weekly-menu`
  **GET** : `/weekly-menu/:id`

- **PATCH** | `/weekly-plan/:id/assign-clients` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali priskirti klientus prie savaitės meniu, jei jis dar nėra publikuotas. Jei gamintojo kliento meniu kiekis yra 1 (default), jis gali būti priskirtas tik prie vieno savaitės meniu plano, kad būtų išvengta dubliavimosi. Jei gamintojo klientas turi nustatytą daugiau nei 1 meniu pasirinkimą, jis gali būti priskirtas prie kelių savaitės meniu per vieną savaitę (pvz., šeimos meniu pasirinkimams). Po sėkmingo priskyrimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-plan/:id/menu-details/:menuId`

- **PATCH** | `/weekly-plan/:id/remove-client` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pašalinti klientą iš savaitės plano meniu, jei jis dar nėra publikuotas. Po sėkmingo pašalinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-plan/:id/menu-details/:menuId`

- **PATCH** | `/weekly-plan/manage-publish-menu` (dokumentacijos nuoroda: `URL`)
  Gamintojas, pridėjęs savaitės meniu ir priskyręs klientus prie kiekvieno savaitės meniu, turi publikuoti meniu, kad būtų galima formuoti užsakymus ir atlikti skaičiavimus. Ši užklausa veikia `Toggle` principu – jei meniu jau publikuotas, jis bus išpublikuotas ir atvirkščiai. Publikavimo metu yra sukuriami uzsakymai. Jei gamintojas pasirenka ispublikuoti meniu, tada visi uzsakymai su susiijusiu meniu yra pasalinami. Po sėkmingo publikavimo/išpublikavimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/weekly-plan`
  **GET** : `/orders`

- **GET** | `/weekly-plan/:id/menu-details/:menuId` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali gauti priskirtų klientų sąrašą prie kiekvieno savaitės meniu plano. Pvz., jei yra 2025 metų 7 savaitė ir priskirti 4 savaitės meniu, gamintojas gali gauti kiekvieno priskirto meniu klientų sąrašą bei patikrinti, ar priskyrimai atitinka atnaujintus duomenis.

### **2.5 Klientai **

#### Priklausomybės:

- Savaitės plano meniu detalės

#### Užklausų Metodai:

- **POST** | `/customers` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pridėti savo klientus į sistemą, kad būtų lengviau ir patogiau valdyti užsakymus. Naudodamas šį metodą, gamintojas gali pridėti klientą savarankiškai, užpildydamas visą reikiamą informaciją apie klientą. Prieš pridedant kiekvieną klientą, tikrinamas gamintojo `checkPlanFeatures` limitas. Po sėkmingo pridėjimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **POST** | `/customers/send-form` (dokumentacijos nuoroda: `URL`)
  `PRO` ir `PREMIUM` plano gamintojai gali išsiųsti formos užklausą savo klientams tiesiogiai el. paštu, kad jie savarankiškai užpildytų informaciją apie save. Po sėkmingo formos išsiuntimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **POST** | `/customers/resend-form` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali persiųsti formą klientui, jei jis negavo ankstesnės formos dėl nežinomų priežasčių arba jei formos token'o galiojimo laikas (36h) pasibaigė. Persiunčiant formą, priekinėje dalyje duomenų atnaujinti nereikia.

- **POST** | `/customers/confirm-form/:token` (dokumentacijos nuoroda: `URL`)
  Klientas užpildo ir pateikia formą serveriui jos patvirtinimui. Kai forma sėkmingai patvirtinama ir kliento duomenys atnaujinami, **WebSocket** siunčia žinutę gamintojui `customer_form_confirmed`, informuodamas apie sėkmingą operaciją. Po patvirtinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **DELETE** | `/customers/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pašalinti klientus iš sistemos naudodamas **Soft delete** principą, suteikiant galimybę peržiūrėti ankstesnių užsakymų ir kitą susijusią informaciją. Jei klientas yra priskirtas prie aktyvaus `SAVAITĖS PLANO`, jo pašalinti negalima. Po sėkmingo pašalinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **PUT** | `/customers/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali bet kuriuo metu atnaujinti kliento duomenis. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`
  **GET** : `/orders` ????? soon

- **GET** | `/customers` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visus savo klientus, kurie nėra ištrinti ar pašalinti iš sistemos **deletedAt: null**. Taip pat galima ieškoti klientų pagal paieškos įvestį bei pasirinktus filtrus.

- **PATCH** | `/customers/:id/change-status/inactive` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pakeisti kliento statusą į `neaktyvus`, laikinai pašalindamas jį iš aktyvių klientų sąrašo. Tai leidžia pridėti daugiau klientų, jei buvo pasiektas limitas. Klientą galima padaryti neaktyvų tik tuo atveju, jei jis nėra priskirtas jokiam aktyviam `SAVAITĖS PLANUI`. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **PATCH** | `/customers/:id/change-status/active` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pakeisti kliento statusą į `aktyvus`, kad jis galėtų būti priskirtas prie `SAVAITĖS PLANO`. Aktyvinant klientą, tikrinamas aktyvių ir laukiančių klientų limitas su `checkPlanFeatures` middleware. Jei limitas viršytas, kliento aktyvuoti nebus galima. Po sėkmingo aktyvavimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **PATCH** | `/customers/:id/change-menu-quantity` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali keisti kliento meniu pasirinkimo kiekį (default – 1). Jei klientas yra priskirtas aktyviam `SAVAITĖS PLANUI`, meniu kiekio keisti nebegalima. Norint pakeisti meniu kiekį, klientas turi būti nepriskirtas jokiam aktyviam savaitės planui. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/customers`

- **POST** | `/customers/:id/calculate-nutrition` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali pasinaudoti rekomenduojamu kliento maistinių medžiagų skaičiavimu. Sistema automatiškai apskaičiuoja reikiamą maistinių medžiagų kiekį pagal tam tikrus kliento parametrus. Po sėkmingo skaičiavimo siuntimo metu pateikiami apskaičiuoti duomenys, todėl kliento pusėje jie gali būti pridėti prie bendrų kliento duomenų.

### **2.6 Užsakymai **

#### Priklausomybės:

- Savaitės planas (publish/unpublish)
- Savaites meniu (updates Bio)
- Klientai (updates)
- Ingredientai (updates)
- Patiekalai (updates)

#### Užklausų Metodai:

- **GET** | `/orders/ingredients-list` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visos savaitės visų meniu ingredientų sąrašą, kuriame nurodoma, kiek bendrai reikia kiekvieno ingrediento pagal pateiktus savaitės planus. Ingredientai yra sumuojami iš visų patiekalų.

- **POST** | `/orders/ingredients-list-combo` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali sujungti kelias pasirinktos savaitės dienas ir gauti bendrą ingredientų sąrašą. Po sėkmingo kombinavimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/orders/ingredients-list`

- **GET** | `/orders/generate-ingredients-pdf` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali generuoti PDF failą pasirinktai dienai ar kombinuotam sąrašui, kad būtų galima jį persiųsti ar atsispausdinti.

- **PATCH** | `/orders/:id/ingredients/enter-stock` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali įvesti turimą kiekvieno ingrediento likutį, kad būtų galima perskaičiuoti ir tiksliai parodyti, kiek dar ingredientų reikia, įskaitant jau turimas atsargas. Po sėkmingo likučių įvedimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/orders/ingredients-list`

- **GET** | `/orders` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna visus pasirinktos savaitės užsakymus, kurie buvo sugeneruoti publikuojant savaitės planą.

- **GET** | `/orders/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gauna konkrečios dienos užsakymus su detalia informacija, kad būtų galima patogiai valdyti tos dienos užsakymus ir patiekalų paruošimo procesą.

- **PATCH** | `/orders/change-status/:id` (dokumentacijos nuoroda: `URL`)
  Gamintojas gali keisti konkretaus patiekalo ruošimo statusą užsakymo dieną, kad būtų lengviau sekti gamybos procesą. Po sėkmingo atnaujinimo priekinėje dalyje turi būti inicijuojamas duomenų atnaujinimas:
  **GET** : `/orders/:id`

- **PATCH** | `/orders/:id` (dokumentacijos nuoroda: `URL`)
  Kai gamintojas baigia dienos gamybos procesą, jis pažymi dieną kaip "atlikta", o visi patiekalai tos dienos užsakymuose automatiškai pakeičiami į `done` statusą. Taip pat pati diena pažymima kaip `done`, o sistemoje inicijuojamas **Snapshot** procesas su visais reikalingais duomenimis. Po šio veiksmo duomenys atnaujinami:
  **GET** : `/orders/:id`
  **GET** : `/orders`
