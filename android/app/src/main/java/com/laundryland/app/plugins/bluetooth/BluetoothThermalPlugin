
package com.laundryland.app.plugins.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name="BluetoothThermal")
public class BluetoothThermalPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void listDevices(PluginCall call){
        try{
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if(adapter==null){ call.reject("Bluetooth tidak tersedia"); return; }
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            JSArray arr = new JSArray();
            for(BluetoothDevice d: paired){
                JSObject obj = new JSObject();
                obj.put("name", d.getName());
                obj.put("address", d.getAddress());
                arr.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("devices", arr);
            call.resolve(ret);
        }catch(Exception e){ call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void print(PluginCall call){
        String text = call.getString("text","");
        String address = call.getString("address",""); // if empty, use first bonded RPP/GZB
        try{
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            BluetoothDevice device = null;
            if(address!=null && !address.isEmpty()){
                device = adapter.getRemoteDevice(address);
            }else{
                for(BluetoothDevice d: adapter.getBondedDevices()){
                    String n = d.getName()!=null?d.getName().toUpperCase():"";
                    if(n.contains("RPP")||n.contains("GZB")||n.contains("MPT")||n.contains("POS")||n.contains("PRINTER")||n.contains("58")){
                        device = d; break;
                    }
                }
                if(device==null && adapter.getBondedDevices().size()>0){
                    device = adapter.getBondedDevices().iterator().next();
                }
            }
            if(device==null){ call.reject("Printer belum paired di Bluetooth HP"); return; }
            BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream os = socket.getOutputStream();
            // ESC/POS init
            os.write(new byte[]{0x1B,0x40});
            os.write(text.getBytes("GBK"));
            os.write(new byte[]{0x0A,0x0A,0x0A,0x1D,0x56,0x00});
            os.flush();
            Thread.sleep(500);
            os.close();
            socket.close();
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("device", device.getName());
            call.resolve(ret);
        }catch(Exception e){
            call.reject("Gagal cetak: "+e.getMessage());
        }
    }

    @PluginMethod
    public void printBase64(PluginCall call){
        String base64 = call.getString("data","");
        String address = call.getString("address","");
        try{
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            BluetoothDevice device = null;
            if(address!=null && !address.isEmpty()){
                device = adapter.getRemoteDevice(address);
            }else{
                for(BluetoothDevice d: adapter.getBondedDevices()){
                    String n = d.getName()!=null?d.getName().toUpperCase():"";
                    if(n.contains("RPP")||n.contains("GZB")||n.contains("MPT")){ device=d; break; }
                }
            }
            if(device==null){ call.reject("Printer belum paired"); return; }
            BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream os = socket.getOutputStream();
            os.write(bytes);
            os.flush();
            Thread.sleep(300);
            os.close();
            socket.close();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }catch(Exception e){ call.reject(e.getMessage()); }
    }
}
