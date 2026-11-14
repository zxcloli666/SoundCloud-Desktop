local YUNO = "https://api.y.uno/v1"
local SDK_VERSION = "10.1.44"
local EXTERNAL_VERSION = "1.6.46"
local HOLDER = "CARD HOLDER"
local USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"

local function text_of(v)
  if type(v) == "string" and v ~= "" then return v end
  return nil
end

local function expiry_of(text)
  local month, year = tostring(text):match("^%s*(%d+)%s*/%s*(%d+)%s*$")
  if month == nil then return nil end
  return tonumber(month), tonumber(year) % 100
end

local function browser_info(i)
  return {
    browser_time_difference = text_of(i.tz_offset) or "0",
    color_depth = "24",
    java_enabled = false,
    screen_width = "1920",
    screen_height = "1080",
    user_agent = USER_AGENT,
    language = text_of(i.language) or "en-US",
    javascript_enabled = true,
    accept_browser = "*/*",
    accept_content = "*/*",
    accept_header = "*/*",
  }
end

local function token_body(i, number, month, year, cvv)
  local body = json_encode({
    payment_method = {
      type = "CARD",
      vault_on_success = false,
      card = {
        expiration_month = month,
        expiration_year = year,
        number = number,
        security_code = cvv,
        holder_name = HOLDER,
      },
      customer = { browser_info = browser_info(i) },
    },
  })
  body = body:gsub('"card":{', '"card":{"type":null,"brand":null,"card_pin":null,', 1)
  return (body:gsub('"payment_method":{',
    '"payment_method":{"three_d_secure":{"three_d_secure_setup_id":null},"third_party_data":[],"device_fingerprints":[],', 1))
end

local function tokenize(i)
  local number, expiry_text, cvv = text_of(i.number), text_of(i.expiry), text_of(i.cvv)
  if number == nil or expiry_text == nil or cvv == nil then return { ok = false, reason = "input" } end
  local month, year = expiry_of(expiry_text)
  if month == nil then return { ok = false, reason = "expiry_format" } end

  local resp = http({
    url = YUNO .. "/checkout/sessions/" .. i.checkout_session .. "/token",
    method = "POST",
    headers = {
      ["public-api-key"] = i.public_api_key,
      ["x-version"] = SDK_VERSION,
      ["x-external-version"] = EXTERNAL_VERSION,
      ["x-platform"] = "web",
      ["x-sub-platform"] = "desktop",
      ["x-sdk-type"] = "lite",
      ["accept-language"] = text_of(i.language) or "en",
      ["Accept"] = "application/json, text/plain, */*",
      ["Content-Type"] = "application/json",
      ["User-Agent"] = USER_AGENT,
    },
    body = token_body(i, (number:gsub("%D", "")), month, year, cvv),
  })
  if resp.status == 0 then error("transport " .. tostring(resp.error)) end
  local parsed = nil
  if type(resp.body) == "string" and resp.body ~= "" then parsed = json_decode(resp.body) end
  if resp.status < 200 or resp.status >= 300 or type(parsed) ~= "table" or text_of(parsed.token) == nil then
    return { ok = false, reason = "token", status = resp.status, response = parsed }
  end
  local card = type(parsed.card_data) == "table" and parsed.card_data or {}
  return {
    ok = true,
    token = parsed.token,
    card = { iin = text_of(card.iin), last4 = text_of(card.lfd), brand = text_of(card.brand) },
  }
end

if text_of(inputs.public_api_key) == nil or text_of(inputs.checkout_session) == nil then
  return { ok = false, reason = "input" }
end
return tokenize(inputs)
