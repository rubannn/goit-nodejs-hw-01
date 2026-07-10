NODE = node
APP = file-organizer.js
DIR = E:\Downloads
SOURCE = E:\Downloads
TARGET = E:\Temp\sorted
DAYS = 90
CONFIRM =

help:
	@type help.txt

scan:
	@$(NODE) $(APP) scan "$(DIR)"

s: scan

duplicates:
	@$(NODE) $(APP) duplicates "$(DIR)"

d: duplicates

organize:
	@$(NODE) $(APP) organize "$(SOURCE)" --output "$(TARGET)"

o: organize

cleanup:
	@$(NODE) $(APP) cleanup "$(DIR)" --older-than $(DAYS) $(CONFIRM)

c: cleanup
