FQBN = esp32:esp32:esp32
PORT = /dev/cu.usbserial-0001

compile:
	arduino-cli compile --fqbn $(FQBN) .

upload:
	arduino-cli upload -p $(PORT) --fqbn $(FQBN) .

flash: compile upload

monitor:
	arduino-cli monitor -p $(PORT) --config baudrate=115200
