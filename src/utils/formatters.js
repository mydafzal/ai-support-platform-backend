function formatHubSpotContactDetails(customer) {
  const properties = customer.properties;

  const formattedDetails = `
        - Name: ${properties.firstname} ${properties.lastname}
        - Email: ${properties.email}
        - Phone: ${properties.phone}
        - Customer ID: ${customer.id}
      `;

  return formattedDetails;
}

module.exports = { formatHubSpotContactDetails };
