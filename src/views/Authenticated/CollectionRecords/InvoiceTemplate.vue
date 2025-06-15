<script setup>
defineProps({
  record: {
    type: Object,
    required: true
  },
  recordItems: {
    type: Array,
    required: true
  }
})

const calculateTotalCost = (items) => {
  return items.reduce((sum, item) => sum + item.total_cost, 0)
}
</script>

<template>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div class="header-left">
        <h1>Forest Products Collection Record</h1>
        <p class="subtitle">Forest Products Collectors Monitoring System</p>
        <p class="subtitle">Department of Forest Science</p>
      </div>
      <div class="header-right">
        <div class="invoice-info">
          <p><strong>Collection Record ID:</strong> #{{ record.id }}</p>
          <p><strong>Date:</strong> {{ new Date(record.created_at).toLocaleDateString() }}</p>
          <p><strong>Status:</strong> {{ record.is_paid ? 'PAID' : 'UNPAID' }}</p>
        </div>
      </div>
    </div>

    <!-- Customer and Purpose Info -->
    <div class="info-section">
      <div class="info-grid">
        <div class="info-item">
          <h3>Collector Details</h3>
          <p>{{ record.user ? `${record.user.first_name} ${record.user.last_name}` : 'N/A' }}</p>
        </div>
        <div class="info-item">
          <h3>Processed By</h3>
          <p>{{ record.created_by ? `${record.created_by.first_name} ${record.created_by.last_name}` : 'N/A' }}</p>
        </div>
        <div class="info-item">
          <h3>Purpose</h3>
          <p>{{ record.purpose || 'N/A' }}</p>
        </div>
        <div class="info-item">
          <h3>Request ID</h3>
          <p>{{ record.collection_request_id }}</p>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th>Forest Product</th>
            <th>Location</th>
            <th>Quantity</th>
            <th>Price/Unit</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in recordItems" :key="item.id">
            <td>
              {{ item.fp_and_location?.forest_product?.name || 'N/A' }}
              <div class="item-details">
              </div>
            </td>
            <td>{{ item.fp_and_location?.location?.name || 'N/A' }}</td>
            <td>
              {{ new Intl.NumberFormat().format(item.deducted_quantity) }}
              {{ item.fp_and_location?.forest_product?.measurement_unit?.unit_name || 'units' }}
            </td>
            <td>
              {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.price_per_unit_during_purchase) }}
            </td>
            <td>
              {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(item.total_cost) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary Section -->
    <div class="summary-section">
      <div class="total-amount">
        <span>Total amount to pay:</span>
        <span class="amount">{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(calculateTotalCost(recordItems)) }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-content">
        <p>Thank you for your business!</p>
        <p class="generated-date">Generated on: {{ new Date().toLocaleDateString() }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invoice-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #10b981;
}

.header-left h1 {
  color: #065f46;
  margin: 0;
  font-size: 24px;
}

.subtitle {
  color: #666;
  margin: 5px 0 0;
}

.invoice-info {
  text-align: right;
}

.invoice-info p {
  margin: 5px 0;
}

.info-section {
  margin-bottom: 30px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-item h3 {
  color: #065f46;
  font-size: 14px;
  margin: 0 0 5px;
}

.info-item p {
  margin: 0;
  color: #333;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.items-table th {
  background-color: #f3f4f6;
  padding: 10px;
  text-align: left;
  font-size: 12px;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}

.items-table td {
  padding: 10px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
}

.item-details {
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.item-details small {
  display: block;
  margin: 2px 0;
}

.summary-section {
  text-align: right;
  margin-bottom: 30px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.total-amount {
  font-size: 18px;
  font-weight: bold;
}

.amount {
  margin-left: 10px;
  color: #065f46;
}

.invoice-footer {
  text-align: center;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.footer-content p {
  margin: 5px 0;
  color: #666;
}

.generated-date {
  font-size: 12px;
}

@media print {
  .invoice-container {
    padding: 0;
  }

  .invoice-header {
    page-break-after: avoid;
  }

  .items-table {
    page-break-inside: avoid;
  }

  .summary-section {
    page-break-before: avoid;
  }
}
</style>
