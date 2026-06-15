#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <BH1750.h>
#include <Wire.h>

// ===== WiFi =====
#define WIFI_SSID "TurkTelekom_Mesh_ZT6HP6"
#define WIFI_PASSWORD "y4sGFER77AeD"

// ===== MQTT =====
#define MQTT_HOST "39e5c60ef9564e76ae073f2e83832b26.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USER "greenHouse_esp32"
#define MQTT_PASS "greenHouse123"
#define DEVICE_ID "sera_001"

// ===== Sensor Pinleri =====
#define DHT_PIN 4
#define SOIL_PIN 34
#define FLOW_PIN 18

// ===== Aktuator Pinleri =====
#define PUMP_PIN 26
#define FAN_PIN 14
#define LIGHT_PIN 25

// ===== Sabitler =====
#define SEND_INTERVAL 30000
#define SOIL_DRY 3200
#define SOIL_WET 1400

// ===== Nesneler =====
DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
WiFiClientSecure espClient;
PubSubClient mqtt(espClient);

// ===== Flow Sensor =====
volatile int pulseCount = 0;
void IRAM_ATTR flowPulse() {
  pulseCount++;
}

unsigned long lastSend = 0;
bool bh1750Ok = false;

// ===== MQTT Callback =====
void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> cmd;
  deserializeJson(cmd, payload, length);

  String actuator = cmd["actuator"];
  bool state = cmd["state"];

  if (actuator == "pump") digitalWrite(PUMP_PIN, state ? HIGH : LOW);  // NO: LOW=calis
  if (actuator == "fan") digitalWrite(FAN_PIN, state ? HIGH : LOW);    // NC: HIGH=calis
  if (actuator == "light") analogWrite(LIGHT_PIN, state ? 255 : 0);
}

// ===== WiFi Bağlantısı =====
void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi baglanıyor");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print(" Baglandi! IP: ");
  Serial.println(WiFi.localIP());
}

// ===== MQTT Bağlantısı =====
void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi yok, MQTT atlanıyor!");
    return;
  }

  espClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(callback);
  mqtt.setBufferSize(512);

  while (!mqtt.connected()) {
    Serial.print("MQTT baglanıyor...");
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("Baglandi!");
      mqtt.subscribe("sera/001/actuators/command");
    } else {
      Serial.print("Hata: ");
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Aktuator pinleri
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, HIGH);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, HIGH);
  pinMode(LIGHT_PIN, OUTPUT);
  analogWrite(LIGHT_PIN, 0);

  // Flow sensor
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulse, RISING);

  // DHT22 ve BH1750 - WiFi'dan ONCE baslat
  dht.begin();
  Wire.begin();
  delay(200);
  bh1750Ok = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (bh1750Ok) {
    Serial.println("BH1750 hazir");
  } else {
    Serial.println("BH1750 bulunamadi, devam ediliyor");
  }

  // WiFi + MQTT
  connectWifi();
  connectMqtt();
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
  delay(10);

  if (millis() - lastSend > SEND_INTERVAL) {
    // DHT22 - 3 deneme
    float temp = NAN, hum = NAN;
    for (int i = 0; i < 3 && (isnan(temp) || isnan(hum)); i++) {
      temp = dht.readTemperature();
      hum = dht.readHumidity();
      if (isnan(temp) || isnan(hum)) delay(500);
    }
    if (isnan(temp)) temp = -99;
    if (isnan(hum)) hum = -99;

    int soil = map(analogRead(SOIL_PIN), SOIL_DRY, SOIL_WET, 0, 100);
    float lux = bh1750Ok ? lightMeter.readLightLevel() : -1;
    float flow = (pulseCount / 7.5);
    pulseCount = 0;

    StaticJsonDocument<256> doc;
    doc["device_id"] = DEVICE_ID;
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["soil"] = soil;
    doc["light_lux"] = lux;
    doc["flow_lpm"] = flow;

    char buffer[256];
    serializeJson(doc, buffer);
    mqtt.publish("sera/001/sensors/telemetry", buffer);

    Serial.println(buffer);
    lastSend = millis();
  }
}
