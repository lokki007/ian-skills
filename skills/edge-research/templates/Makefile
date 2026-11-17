# EdgeResearch run Makefile (optional example)
#
# Run from the project root that holds runs/:
#   make -f runs/<name>/Makefile NAME=<name> baseline|mutate|eval|diff|ledger
#
# The four core commands. If any of these can't be trusted to write a
# results.tsv row, the loop isn't done.

PYTHON  ?= python
RUN     ?= runs/$(NAME)
ART     ?= $(RUN)/baseline
HARNESS ?= $(PYTHON) $(RUN)/harness.py
DIFF    ?= $(PYTHON) $(RUN)/diff_rows.py

.PHONY: baseline mutate eval diff ledger help check-name

help:
	@echo "make -f runs/<name>/Makefile NAME=<name> baseline|mutate|eval|diff|ledger"

check-name:
	@if [ -z "$(NAME)" ]; then echo "NAME=<run-name> required"; exit 1; fi

baseline: check-name
	$(HARNESS) --artifact $(ART) --kind current-real --output $(RUN)/results.tsv --row 0

mutate: check-name
	@echo "Edit $(RUN)/candidate/ (one bounded surface), then run 'make eval NAME=$(NAME)'"

eval: check-name
	$(HARNESS) --artifact $(RUN)/candidate --kind mutation --output $(RUN)/results.tsv --row auto

diff: check-name
	$(DIFF) --tsv $(RUN)/results.tsv --last-two

ledger: check-name
	@column -t -s "$$(printf '\t')" $(RUN)/results.tsv
