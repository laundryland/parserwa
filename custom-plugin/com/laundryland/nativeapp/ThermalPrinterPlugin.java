package com.laundryland.nativeapp;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

@CapacitorPlugin(name = "ThermalPrinter")
public class ThermalPrinterPlugin extends Plugin {

    @PluginMethod
    public void getPrinters(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("count", 0);
        ret.put("printers", new JSArray());
        call.resolve(ret);
    }

    @PluginMethod
    public void print58mm(PluginCall call) {
        String text = call.getString("text", "");
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("length", text.length());
        call.resolve(ret);
    }

    @PluginMethod
    public void shareNotaWA(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }
}
