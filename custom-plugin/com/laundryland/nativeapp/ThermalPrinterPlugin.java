
package com.laundryland.nativeapp;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "ThermalPrinter")
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "LaundryPrinter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private BluetoothSocket socket;
    private OutputStream outputStream;

    @PluginMethod
    public void getBondedDevices(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not supported");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("Bluetooth not enabled");
                return;
            }

            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray devices = new JSArray();
            for (BluetoothDevice d : bonded) {
                JSObject obj = new JSObject();
                obj.put("name", d.getName());
                obj.put("address", d.getAddress());
                // Filter printer-like devices
                String name = d.getName() != null ? d.getName().toLowerCase() : "";
                boolean isPrinter = name.contains("printer") || name.contains("rpp") || name.contains("pos") || name.contains("thermal") || name.contains("ep") || name.contains("58") || name.contains("80");
                obj.put("isPrinter", isPrinter);
                devices.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "getBonded error", e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void printNota(PluginCall call) {
        String address = call.getString("printerAddress");
        String text = call.getString("text");
        String imageBase64 = call.getString("imageBase64");
        String html = call.getString("html");
        Boolean cut = call.getBoolean("cut", true);

        // If no address, use last saved or first printer
        if (address == null || address.isEmpty()) {
            address = getContext().getSharedPreferences("laundryland", 0).getString("last_printer", null);
        }

        if (address == null && text == null && imageBase64 == null) {
            call.reject("No printer address and no data");
            return;
        }

        try {
            if (address != null) {
                connectPrinter(address);
            }

            if (imageBase64 != null && !imageBase64.isEmpty()) {
                printImageFromBase64(imageBase64);
            } else if (text != null && !text.isEmpty()) {
                printText58mm(text);
            } else if (html != null) {
                // Simple strip html to text for thermal
                String stripped = html.replaceAll("<[^>]*>", "\n").replaceAll("&nbsp;", " ");
                printText58mm(stripped);
            }

            if (cut) {
                cutPaper();
            }

            // Save last printer
            if (address != null) {
                getContext().getSharedPreferences("laundryland", 0).edit().putString("last_printer", address).apply();
            }

            // Don't close immediately, keep socket for next print
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Printed to " + address);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Print error", e);
            call.reject("Print failed: " + e.getMessage());
            disconnect();
        }
    }

    @PluginMethod
    public void shareToWhatsAppBusiness(PluginCall call) {
        String imageBase64 = call.getString("imageBase64");
        String phone = call.getString("phone", "");
        String text = call.getString("text", "Nota LaundryLand");
        String fileName = call.getString("fileName", "nota-laundryland.png");

        if (imageBase64 == null) {
            call.reject("No image");
            return;
        }

        try {
            // Decode base64
            String base64Data = imageBase64;
            if (base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }
            byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);

            // Save to cache
            File cachePath = new File(getContext().getCacheDir(), "images");
            cachePath.mkdirs();
            File file = new File(cachePath, fileName);
            FileOutputStream fos = new FileOutputStream(file);
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.close();

            Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // Try WhatsApp Business first
            boolean waBusinessInstalled = isPackageInstalled("com.whatsapp.w4b");
            boolean waInstalled = isPackageInstalled("com.whatsapp");

            if (waBusinessInstalled) {
                intent.setPackage("com.whatsapp.w4b");
                // If phone specified, try direct
                if (phone != null && !phone.isEmpty()) {
                    // For direct chat, we need to use wa.me but with image we fallback to share
                    // So we still use ACTION_SEND with package
                }
            } else if (waInstalled) {
                intent.setPackage("com.whatsapp");
            }

            Intent chooser = Intent.createChooser(intent, "Kirim Nota via WA Bisnis");
            getActivity().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("sharedTo", waBusinessInstalled ? "whatsapp_business" : "whatsapp");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Share error", e);
            call.reject(e.getMessage());
        }
    }

    private void connectPrinter(String address) throws Exception {
        if (socket != null && socket.isConnected() && address.equals(getContext().getSharedPreferences("laundryland", 0).getString("last_printer", ""))) {
            return; // already connected
        }
        disconnect();
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        BluetoothDevice device = adapter.getRemoteDevice(address);
        socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        socket.connect();
        outputStream = socket.getOutputStream();
        Thread.sleep(200);
    }

    private void disconnect() {
        try {
            if (outputStream != null) outputStream.close();
            if (socket != null) socket.close();
        } catch (Exception e) {}
        outputStream = null;
        socket = null;
    }

    private void printText58mm(String text) throws Exception {
        if (outputStream == null) throw new Exception("Not connected to printer");

        // ESC/POS Init
        outputStream.write(new byte[]{0x1B, 0x40}); // INIT
        outputStream.write(new byte[]{0x1B, 0x61, 0x01}); // Align center
        outputStream.write(new byte[]{0x1B, 0x21, 0x08}); // Bold

        // Header LaundryLand
        String header = "LAUNDRYLAND\n";
        outputStream.write(header.getBytes("GBK"));
        outputStream.write(new byte[]{0x1B, 0x21, 0x00}); // Normal
        outputStream.write(new byte[]{0x1B, 0x61, 0x00}); // Align left

        // Print content - wrap to 32 chars for 58mm
        String[] lines = text.split("\n");
        for (String line : lines) {
            // Wrap long lines
            if (line.length() > 32) {
                int idx = 0;
                while (idx < line.length()) {
                    int end = Math.min(idx + 32, line.length());
                    String chunk = line.substring(idx, end);
                    outputStream.write((chunk + "\n").getBytes("GBK"));
                    idx = end;
                }
            } else {
                outputStream.write((line + "\n").getBytes("GBK"));
            }
        }
        outputStream.write("\n\n".getBytes());
        outputStream.flush();
    }

    private void printImageFromBase64(String base64) throws Exception {
        if (outputStream == null) throw new Exception("Not connected");
        String data = base64;
        if (data.contains(",")) data = data.split(",")[1];
        byte[] decoded = Base64.decode(data, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);

        // Resize to 384px width (58mm = 384 dots)
        int targetWidth = 384;
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        float ratio = (float) targetWidth / width;
        int targetHeight = (int) (height * ratio);
        Bitmap resized = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true);

        // Convert to ESC/POS raster
        byte[] raster = bitmapToEscPosRaster(resized);
        outputStream.write(raster);
        outputStream.write("\n\n".getBytes());
        outputStream.flush();
    }

    private byte[] bitmapToEscPosRaster(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerLine = (width + 7) / 8;
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // GS v 0 - raster bit image
        baos.write(0x1D);
        baos.write(0x76);
        baos.write(0x30);
        baos.write(0x00);
        baos.write(bytesPerLine & 0xFF);
        baos.write((bytesPerLine >> 8) & 0xFF);
        baos.write(height & 0xFF);
        baos.write((height >> 8) & 0xFF);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < bytesPerLine; x++) {
                int b = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int px = x * 8 + bit;
                    if (px < width) {
                        int color = bitmap.getPixel(px, y);
                        int r = (color >> 16) & 0xFF;
                        int g = (color >> 8) & 0xFF;
                        int bl = color & 0xFF;
                        int gray = (r + g + bl) / 3;
                        if (gray < 128) {
                            b |= (1 << (7 - bit));
                        }
                    }
                }
                baos.write(b);
            }
        }
        return baos.toByteArray();
    }

    private void cutPaper() throws Exception {
        if (outputStream == null) return;
        // Partial cut
        outputStream.write(new byte[]{0x1D, 0x56, 0x01});
        outputStream.flush();
    }

    private boolean isPackageInstalled(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
