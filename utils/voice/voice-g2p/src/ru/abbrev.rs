const PHRASES: &[(&str, &str)] = &[
    ("и т. д.", "и так далее"),
    ("и т.д.", "и так далее"),
    ("и т. п.", "и тому подобное"),
    ("и т.п.", "и тому подобное"),
    ("т. е.", "то есть"),
    ("т.е.", "то есть"),
    ("т. к.", "так как"),
    ("т.к.", "так как"),
    ("т. н.", "так называемый"),
    ("т.н.", "так называемый"),
    ("и др.", "и другие"),
    ("и пр.", "и прочее"),
    ("напр.", "например"),
    ("см.", "смотри"),
    ("ул.", "улица"),
    ("пр-т", "проспект"),
    ("тел.", "телефон"),
    ("млн", "миллионов"),
    ("млрд", "миллиардов"),
    ("тыс.", "тысяч"),
    ("№", "номер "),
    ("&", " и "),
];

pub fn expand(text: &str) -> String {
    let mut out = text.to_string();
    for (from, to) in PHRASES {
        let mut start = 0;
        while let Some(found) = out[start..].to_lowercase().find(from) {
            let at = start + found;
            let end = at + from.len();
            let before_ok = out[..at].chars().last().is_none_or(|c| !c.is_alphanumeric());
            let after_ok = from.ends_with('.') || out[end..].chars().next().is_none_or(|c| !c.is_alphanumeric());
            if before_ok && after_ok && out.is_char_boundary(end) {
                out.replace_range(at..end, to);
                start = at + to.len();
            } else {
                start = end;
            }
            if start >= out.len() {
                break;
            }
        }
    }
    out
}
