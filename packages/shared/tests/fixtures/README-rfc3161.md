# `rfc3161-timestamp.json`

A genuine RFC-3161 `TimeStampResp`, signed by a throwaway CA created for
this purpose. It exists so `freetsa.test.ts` validates real DER produced
by an independent implementation (OpenSSL) instead of DER produced by the
code under test — a validator tested only against its own encoder proves
nothing about the responses it will actually receive.

Regenerate:

```bash
openssl req -x509 -newkey rsa:2048 -keyout ca.key -out ca.crt -days 3650 -nodes \
  -subj "/CN=ARCTOS Test TSA CA"

cat > tsa.cnf <<'EOF'
[req]
distinguished_name=dn
[dn]
[tsa_ext]
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=critical,timeStamping
EOF

openssl req -newkey rsa:2048 -keyout tsa.key -out tsa.csr -nodes -subj "/CN=ARCTOS Test TSA"
openssl x509 -req -in tsa.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out tsa.crt \
  -days 3650 -extfile tsa.cnf -extensions tsa_ext

cat > tsa_config.cnf <<'EOF'
[tsa]
default_tsa = tsa_config1
[tsa_config1]
serial = tsaserial
crypto_device = builtin
signer_cert = tsa.crt
certs = ca.crt
signer_key = tsa.key
signer_digest = sha256
default_policy = 1.2.3.4.1
digests = sha256, sha512
accuracy = secs:1
clock_precision_digits = 0
ordering = yes
tsa_name = yes
ess_cert_id_chain = no
EOF
echo 01 > tsaserial

printf 'ARCTOS-WP4-TEST-ROOT-0000000001\n' | openssl dgst -sha256 -binary > root.bin
openssl ts -query -data root.bin -sha256 -cert -out req.tsq
openssl ts -reply -config tsa_config.cnf -queryfile req.tsq -out resp.tsr
openssl ts -verify -data root.bin -in resp.tsr -CAfile ca.crt -untrusted tsa.crt
```

`messageImprintHex` is `SHA-256(root.bin)` — the value the query put into
the `messageImprint`, printed by `openssl ts -query -in req.tsq -text`.
`nonceHex` comes from the same output.

The certificate is valid until 2036; when it expires the `genTime` window
check in `verifyTimestampResponse` will start rejecting the fixture, which
is the correct behaviour and the signal to regenerate.
