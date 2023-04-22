# Generated by Django 4.1.5 on 2023-04-19 10:04

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Esummit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('venue', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('checkout', models.URLField()),
            ],
        ),
        migrations.CreateModel(
            name='Fest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('venue', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('checkout', models.URLField()),
            ],
        ),
        migrations.CreateModel(
            name='Hackathon',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('venue', models.CharField(max_length=255)),
                ('prize_money', models.DecimalField(decimal_places=2, max_digits=10)),
                ('description', models.TextField()),
                ('date', models.DateField()),
                ('Apply', models.URLField()),
            ],
        ),
    ]
