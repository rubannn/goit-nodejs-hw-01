NODE = node
APP = file-organizer.js
DIR = E:\Downloads
SOURCE = .
TARGET = .\sorted
DAYS = 90
CONFIRM =

help:
	echo Available targets:
	echo make scan DIR=E:\Downloads
	echo make s DIR=E:\Downloads
	echo make duplicates DIR=E:\Downloads
	echo make d DIR=E:\Downloads
	echo make organize SOURCE=E:\Downloads TARGET=.\sorted
	echo make o SOURCE=E:\Downloads TARGET=.\sorted
	echo make cleanup DIR=E:\Downloads DAYS=90
	echo make c DIR=E:\Downloads DAYS=90
	echo make c DIR=E:\Downloads DAYS=90 CONFIRM=--confirm

scan:
	$(NODE) $(APP) scan "$(DIR)"

s: scan

duplicates:
	$(NODE) $(APP) duplicates "$(DIR)"

d: duplicates

organize:
	$(NODE) $(APP) organize "$(SOURCE)" "$(TARGET)"

o: organize

cleanup:
	$(NODE) $(APP) cleanup "$(DIR)" --older-than $(DAYS) $(CONFIRM)

c: cleanup
