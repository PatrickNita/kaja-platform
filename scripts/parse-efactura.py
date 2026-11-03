"""Read an e-Factura export without modifying it. Money is converted exactly to bani."""
import sys, json, hashlib
from decimal import Decimal
import xml.etree.ElementTree as ET

raw = open(sys.argv[1], 'rb').read()
if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
    raise ValueError('XML entities are not supported')
def bani(value):
    amount = Decimal(value) * 100
    if amount != amount.to_integral_value(): raise ValueError('Fractional bani')
    return int(amount)
invoices = []
for document in ET.fromstring(raw).findall('Document'):
    info = document.find('SupplierInfo')
    buyer, supplier = info.find('Buyer'), info.find('Supplier')
    lines = []
    for row in info.findall('Merchandises/Row'):
        quantity = Decimal(row.get('Quantity'))
        if quantity != quantity.to_integral_value() or quantity <= 0: raise ValueError('Invalid quantity')
        total = bani(row.get('TotalPrice'))
        if total % int(quantity): raise ValueError('Non-integral unit price')
        lines.append(dict(code=row.get('Code'), name=row.get('Name'), quantity=int(quantity), price=total//int(quantity)))
    invoices.append(dict(series=info.findtext('Seria'), number=info.findtext('Number'), issuedAt=info.findtext('IssuedDate'),
        supplierIdno=supplier.get('IDNO'), buyerIdno=buyer.get('IDNO'), buyerName=buyer.get('Title'),
        legalAddress=buyer.get('Address'), deliveryPoint=info.findtext('UnloadingPoint'), total=bani(info.findtext('Total')), lines=lines))
print(json.dumps(dict(sourceSha256=hashlib.sha256(raw).hexdigest(), invoices=invoices)))
