local BASE = "https://proxy-ee.smart-glocal.com"
local HOLDER = "CARD HOLDER"

local function sg(method, path, public_token, body)
  local resp = http({
    url = BASE .. path,
    method = method,
    headers = { ["X-PUBLIC-TOKEN"] = public_token, ["Content-Type"] = "application/json" },
    body = body ~= nil and json_encode(body) or nil,
  })
  if resp.status == 0 then error("transport " .. tostring(resp.error)) end
  local parsed = nil
  if type(resp.body) == "string" and resp.body ~= "" then parsed = json_decode(resp.body) end
  return resp.status, parsed
end

local function tokenize(public_token, kind, value)
  local element = { ref = kind, type = kind }
  element[kind] = value
  local status, parsed = sg("POST", "/cds/v1/tokenize/elements", public_token, { card_elements = { element } })
  if status ~= 200 or type(parsed) ~= "table" or type(parsed.data) ~= "table" then
    return nil, { ok = false, reason = "tokenize_" .. kind, status = status, response = parsed }
  end
  local inner = parsed.data[kind]
  if type(inner) == "table" then inner = inner.token or inner.hash end
  if type(inner) ~= "string" then
    return nil, { ok = false, reason = "tokenize_" .. kind, status = status, response = parsed }
  end
  return inner
end

local function expiry_value(text)
  local month, year = tostring(text):match("^%s*(%d+)%s*/%s*(%d+)%s*$")
  if month == nil then return nil end
  return { month = tonumber(month), year = tonumber(year:sub(-2)) }
end

local function text_of(v)
  if type(v) == "string" and v ~= "" then return v end
  return nil
end

local FINISHED_BADLY = { failed = true, cancelled = true, canceled = true }

local function failure(err, fallback)
  if type(err) == "table" and type(err.code) == "string" then
    return { state = "failed", reason = err.code, description = text_of(err.description) }
  end
  return { state = "failed", reason = fallback }
end

local function summarize(parsed)
  local session = type(parsed) == "table" and parsed.payment_session or nil
  if type(session) ~= "table" then return { state = "pending" } end
  local payment = type(session.acquiring_payments) == "table" and session.acquiring_payments[1] or nil
  if type(payment) ~= "table" then
    if FINISHED_BADLY[session.status] then return failure(session.error, session.status) end
    return { state = "pending" }
  end
  if payment.status == "succeeded" then return { state = "succeeded" } end
  if FINISHED_BADLY[payment.status] then return failure(payment.error or session.error, payment.status) end
  local interaction = payment.customer_interaction
  if type(interaction) == "table" and interaction.type == "redirect" and type(interaction.redirect) == "table"
    and type(interaction.redirect.url) == "string" then
    local method = interaction.redirect.method
    if method ~= nil and string.upper(tostring(method)) ~= "GET" then
      return { state = "failed", reason = "redirect_method", description = tostring(method) }
    end
    return { state = "redirect", url = interaction.redirect.url }
  end
  return { state = "pending" }
end

local function bind(i)
  local number, expiry_text, cvv = text_of(i.number), text_of(i.expiry), text_of(i.cvv)
  if number == nil or expiry_text == nil or cvv == nil then
    return { ok = false, reason = "input" }
  end
  local expiry_object = expiry_value(expiry_text)
  if expiry_object == nil then return { ok = false, reason = "expiry_format" } end

  local init_body = { widget_name = text_of(i.widget_name) or "acquiring_widget" }
  local init_status, init_response = sg("POST", "/widget/v1/init", i.public_token, init_body)
  if init_status ~= 200 then return { ok = false, reason = "init", status = init_status, response = init_response } end

  local tokens = {}
  local err
  tokens.number, err = tokenize(i.public_token, "card_number", (number:gsub("%D", "")))
  if err ~= nil then return err end
  tokens.expiry, err = tokenize(i.public_token, "expire_date", expiry_object)
  if err ~= nil then return err end
  tokens.cvv, err = tokenize(i.public_token, "cvv", cvv)
  if err ~= nil then return err end
  tokens.holder, err = tokenize(i.public_token, "cardholder", HOLDER)
  if err ~= nil then return err end

  local status, parsed = sg("POST", "/widget/v1/payment", i.public_token, {
    payment_details = {
      type = "card",
      card = {
        type = "encrypted_card",
        encrypted_card = {
          number_hash = tokens.number,
          expiration_date_hash = tokens.expiry,
          security_code_hash = tokens.cvv,
          cardholder_name_hash = tokens.holder,
        },
      },
    },
    payment_options = { recurrent = true },
  })
  if status ~= 200 then return { ok = false, reason = "payment", status = status, response = parsed } end
  local result = summarize(parsed)
  result.ok = true
  result.status = status
  result.response = parsed
  return result
end

local function poll(i)
  local status, parsed = sg("GET", "/widget/v1/session/status", i.public_token, nil)
  if status ~= 200 then return { ok = false, reason = "status", status = status, response = parsed } end
  local result = summarize(parsed)
  result.ok = true
  result.status = status
  result.response = parsed
  return result
end

if text_of(inputs.public_token) == nil then return { ok = false, reason = "input" } end
if inputs.action == "status" then return poll(inputs) end
return bind(inputs)
