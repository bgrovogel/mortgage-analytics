using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategyComparisons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Strategy",
                table: "SavedCalculations",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Strategy",
                table: "SavedCalculations");
        }
    }
}
