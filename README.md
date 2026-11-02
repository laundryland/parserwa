
# LaundryLand APK Native v28.1 - 2 versi

## Isi ZIP
- www/index.html : sudah patch share tanpa toast + bridge native
  - PWA: navigator.share(files) -> share sheet tanpa toast
  - APK: Capacitor Share + Filesystem -> Intent WA langsung tanpa toast
- www/track.html : 400px vertical stages + refresh icon + logo GitHub raw
- capacitor.config.json, package.json
- android/.../BluetoothThermalPlugin.java : Bluetooth Classic (SPP) untuk RPP02N/GZB100/EP-5802

## Build APK (1x setup)
1. npm install
2. npx cap add android
3. copy file BluetoothThermalPlugin.java ke android/app/src/main/java/com/laundryland/app/plugins/bluetooth/
4. di android/app/src/main/java/com/laundryland/app/MainActivity.java tambahkan:
   ```
   import com.laundryland.app.plugins.bluetooth.BluetoothThermalPlugin;
   ...
   add(BluetoothThermalPlugin.class);
   ```
5. AndroidManifest.xml tambah permission:
   ```
   <uses-permission android:name="android.permission.BLUETOOTH"/>
   <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
   <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
   <uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
   ```
6. npx cap copy android
7. buka di Android Studio -> Build APK

## Perbedaan 2 versi
- PWA Full (LaundryLand_PWA_Full_v28_STABIL.zip): Web Bluetooth BLE, share via Web Share API tanpa toast (sheet)
- APK Native (ini): Bluetooth Classic + USB, auto-detect paired printer, share langsung Intent WA tanpa toast + tanpa paste

## Fungsi baru di index.html
- shareGambarNotaTanpaToast_Native(notaId): cek Capacitor Share dulu, fallback Web Share, fallback clipboard silent
- window.BluetoothClassic.print(notaId): kalau native pakai plugin Classic, kalau PWA pakai printViaBluetooth lama
- showPilihanKirim di-override: di APK langsung share, di PWA tetap modal 4 pilihan tapi gambar tanpa toast

## Cara pakai user
- Antrian -> Share WA -> di APK langsung buka WA dengan gambar nempel, tinggal Kirim
- Print Thermal -> konek sekali di Setting Bluetooth HP, pairing RPP02N/GZB100, selanjutnya auto
