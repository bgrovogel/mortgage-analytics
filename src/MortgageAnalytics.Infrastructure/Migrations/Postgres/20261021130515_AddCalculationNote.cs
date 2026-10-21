using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddCalculationNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "SavedCalculations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Note",
                table: "SavedCalculations");
        }
    }
}
