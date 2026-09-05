# BBQ — Build de la app nativa (Capacitor)

La app web (`www/`) se empaqueta como **app nativa Android/iPhone** con Capacitor.
Esto habilita lo que la PWA no puede: **leer la agenda del teléfono** y **notificaciones push**.

> Para una primera prueba en teléfonos NO necesitás esto: alcanza con abrir la URL
> del servidor desplegado (Render) y "Agregar a pantalla de inicio". Capacitor es
> para el APK/IPA con agenda real + push.

---

## Requisitos

- **Node 18+**
- **Android:** [Android Studio](https://developer.android.com/studio) (SDK + emulador o teléfono con depuración USB)
- **iPhone:** **macOS** con **Xcode** (obligatorio; iOS no se compila en Windows)

---

## 1. Instalar dependencias

```bash
npm install
```

## 2. Apuntar la app al servidor desplegado

En la app nativa no hay "origin" web, así que hay que decirle dónde está el servidor.
Editá `www/index.html` y agregá **antes** de los `<script>` del final:

```html
<script>window.BBQ_SERVER = "https://TU-APP.onrender.com";</script>
```

(Reemplazá por la URL real de tu deploy en Render.)

## 3. Agregar las plataformas

```bash
npx cap add android
npx cap add ios        # solo en macOS
npm run cap:sync
```

## 4. Permisos nativos

Los plugins ya están en `package.json`:
- `@capacitor-community/contacts` — leer agenda
- `@capacitor/share` — invitar por WhatsApp/SMS
- `@capacitor/push-notifications` — push

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.READ_CONTACTS"/>
```

**iOS** (`ios/App/App/Info.plist`):
```xml
<key>NSContactsUsageDescription</key>
<string>BBQ usa tu agenda para mostrarte qué contactos ya tienen BBQ.</string>
```

## 5. Compilar / abrir

```bash
npx cap open android    # abre Android Studio → Run / Build APK
npx cap open ios        # abre Xcode → Run / Archive
```

Desde Android Studio podés generar el **APK** (Build → Build Bundle(s)/APK(s)) y pasarlo
a los teléfonos. Desde Xcode se corre en un iPhone conectado o se sube a TestFlight.

---

## Flujo tras cada cambio en la web

```bash
npm run cap:sync        # copia www/ a las plataformas nativas
```
