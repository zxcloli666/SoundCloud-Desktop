use serde::Deserialize;
use zeroize::Zeroize;

const NUMBER_LEN: std::ops::RangeInclusive<usize> = 12..=19;
const MAX_YEARS_AHEAD: i32 = 20;

#[derive(Deserialize)]
pub struct Card {
    pub number: String,
    pub expiry: String,
    pub cvv: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CardError {
    Number,
    Expiry,
    Cvv,
}

impl CardError {
    pub fn code(&self) -> &'static str {
        match self {
            CardError::Number => "invalid_number",
            CardError::Expiry => "invalid_expiry",
            CardError::Cvv => "invalid_cvv",
        }
    }
}

impl Card {
    pub fn tidy(&mut self, year: i32, month: u32) -> Result<(), CardError> {
        self.number.retain(|c| c.is_ascii_digit());
        if !NUMBER_LEN.contains(&self.number.len()) || !luhn(&self.number) {
            return Err(CardError::Number);
        }
        self.expiry = expiry(&self.expiry, year, month).ok_or(CardError::Expiry)?;
        let cvv_len = if self.number.len() == 15 { 4 } else { 3 };
        if self.cvv.len() != cvv_len || !self.cvv.bytes().all(|b| b.is_ascii_digit()) {
            return Err(CardError::Cvv);
        }
        Ok(())
    }

    pub fn secrets(&self) -> [&str; 3] {
        [&self.number, &self.expiry, &self.cvv]
    }
}

impl Drop for Card {
    fn drop(&mut self) {
        self.number.zeroize();
        self.expiry.zeroize();
        self.cvv.zeroize();
    }
}

fn luhn(digits: &str) -> bool {
    let sum: u32 = digits
        .bytes()
        .rev()
        .enumerate()
        .map(|(at, byte)| {
            let digit = u32::from(byte - b'0');
            match at % 2 {
                1 if digit * 2 > 9 => digit * 2 - 9,
                1 => digit * 2,
                _ => digit,
            }
        })
        .sum();
    sum.is_multiple_of(10)
}

fn expiry(raw: &str, year_now: i32, month_now: u32) -> Option<String> {
    let (month, year) = raw.trim().split_once('/')?;
    let (month, year) = (month.trim(), year.trim());
    if !(1..=2).contains(&month.len()) || !matches!(year.len(), 2 | 4) {
        return None;
    }
    let month: u32 = month.parse().ok()?;
    let year: i32 = year.parse().ok()?;
    let year = if year < 100 { 2000 + year } else { year };
    let in_range = (1..=12).contains(&month) && year <= year_now + MAX_YEARS_AHEAD;
    let not_past = (year, month) >= (year_now, month_now);
    (in_range && not_past).then(|| format!("{month:02}/{:02}", year % 100))
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: (i32, u32) = (2026, 11);

    fn card(number: &str, expiry: &str, cvv: &str) -> Card {
        Card {
            number: number.into(),
            expiry: expiry.into(),
            cvv: cvv.into(),
        }
    }

    fn tidy(mut card: Card) -> Result<Card, CardError> {
        card.tidy(NOW.0, NOW.1).map(|()| card)
    }

    #[test]
    fn a_well_formed_card_is_cleaned_up() {
        let done = tidy(card("4242 4242 4242 4242", "9/28", "123")).unwrap();
        assert_eq!(done.number, "4242424242424242");
        assert_eq!(done.expiry, "09/28");
    }

    #[test]
    fn luhn_rejects_a_typo_and_accepts_known_numbers() {
        for good in [
            "4242424242424242",
            "5555555555554444",
            "378282246310005",
            "2200000000000004",
        ] {
            assert!(luhn(good), "{good}");
        }
        for bad in ["4242424242424241", "1234567812345678", "0000000000000001"] {
            assert!(!luhn(bad), "{bad}");
        }
    }

    #[test]
    fn number_errors() {
        assert_eq!(
            tidy(card("4242 4242 4242 4241", "12/28", "123")).err(),
            Some(CardError::Number)
        );
        assert_eq!(
            tidy(card("", "12/28", "123")).err(),
            Some(CardError::Number)
        );
        assert_eq!(
            tidy(card("4242", "12/28", "123")).err(),
            Some(CardError::Number)
        );
    }

    #[test]
    fn expiry_rules() {
        let ok = |text: &str| tidy(card("4242424242424242", text, "123")).is_ok();
        assert!(ok("11/26"));
        assert!(ok("12/2026"));
        assert!(ok("01/46"));
        assert!(!ok("10/26"));
        assert!(!ok("00/28"));
        assert!(!ok("13/28"));
        assert!(!ok("01/47"));
        assert!(!ok("1228"));
        assert!(!ok("12/2"));
        assert!(!ok("ab/cd"));
    }

    #[test]
    fn cvv_is_three_digits_or_four_on_a_fifteen_digit_card() {
        assert_eq!(
            tidy(card("4242424242424242", "12/28", "12")).err(),
            Some(CardError::Cvv)
        );
        assert_eq!(
            tidy(card("4242424242424242", "12/28", "1234")).err(),
            Some(CardError::Cvv)
        );
        assert_eq!(
            tidy(card("4242424242424242", "12/28", "12a")).err(),
            Some(CardError::Cvv)
        );
        assert!(tidy(card("378282246310005", "12/28", "1234")).is_ok());
        assert_eq!(
            tidy(card("378282246310005", "12/28", "123")).err(),
            Some(CardError::Cvv)
        );
    }

    #[test]
    fn a_name_sent_by_an_old_form_is_ignored() {
        let sent: Card = serde_json::from_str(
            r#"{"number":"4242","expiry":"12/28","cvv":"123","cardholder":"IVAN PETROV"}"#,
        )
        .unwrap();
        assert_eq!(sent.secrets(), ["4242", "12/28", "123"]);
    }
}
