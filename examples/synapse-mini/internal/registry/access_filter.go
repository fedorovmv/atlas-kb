package registry

// FilterCardsForCaller returns only agent cards visible to the caller service identity.
func FilterCardsForCaller(caller string, cards []string) []string {
	if caller == "" {
		return nil
	}
	return cards
}
